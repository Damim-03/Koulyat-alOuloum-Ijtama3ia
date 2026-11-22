import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { serverMessage } from "../../../lib/api/error";
import { blobErrorMessage, downloadBlob } from "../../../lib/download";
import { messagesApi, type MessageAttachment } from "../api/messages.api";
import { FILE_EXTENSIONS, MAX_FILE_MB, MAX_FILES, fileKind, type FileKind } from "../messages-utils";

/**
 * Files on their way into a message.
 *
 * Each file is uploaded the moment it is chosen — so its progress shows, and
 * sending is instant — and stays a draft on the server until a message
 * carries it. Taken back before sending, or left behind when the composer
 * closes, the draft is deleted; anything missed is swept by the server after
 * a day.
 */
export interface Draft {
  key: string;
  file: File;
  name: string;
  size: number;
  kind: FileKind;
  /** A local address for an image's thumbnail, before the server has it. */
  preview: string | null;
  status: "uploading" | "ready" | "failed";
  /** 0..1 */
  progress: number;
  attachment?: MessageAttachment;
  error?: string;
}

let seq = 0;

export function useAttachmentDrafts() {
  const { t } = useTranslation();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  // The list as it stands now — read by the callbacks between renders, and
  // by the cleanup when the composer goes away.
  const box = useRef({ list: [] as Draft[], uploads: new Map<string, AbortController>() });

  const update = useCallback((fn: (list: Draft[]) => Draft[]) => {
    box.current.list = fn(box.current.list);
    setDrafts(box.current.list);
  }, []);
  const patch = useCallback(
    (key: string, p: Partial<Draft>) => update((list) => list.map((d) => (d.key === key ? { ...d, ...p } : d))),
    [update],
  );

  const start = useCallback(
    (key: string, file: File) => {
      const ctl = new AbortController();
      box.current.uploads.set(key, ctl);
      messagesApi
        .uploadAttachment(file, { signal: ctl.signal, onProgress: (f) => patch(key, { progress: f }) })
        .then((attachment) => {
          // Taken back while it was uploading: the server keeps nothing.
          if (!box.current.list.some((d) => d.key === key)) {
            void messagesApi.deleteAttachment(attachment.id).catch(() => undefined);
            return;
          }
          patch(key, { status: "ready", progress: 1, attachment });
        })
        .catch((e) => {
          if (ctl.signal.aborted) return;
          patch(key, { status: "failed", error: serverMessage(e, t("msg.files.failed")) });
        })
        .finally(() => box.current.uploads.delete(key));
    },
    [patch, t],
  );

  /** Checks each file as the server would, then uploads the ones that pass. */
  const add = useCallback(
    (input: FileList | File[]) => {
      const files = Array.from(input);
      if (files.length === 0) return;
      const room = MAX_FILES - box.current.list.length;
      const errors = new Set<string>();
      const accepted: Draft[] = [];
      for (const file of files) {
        const ext = `.${file.name.split(".").pop() ?? ""}`.toLowerCase();
        if (!FILE_EXTENSIONS.includes(ext)) errors.add(t("msg.files.badType", { name: file.name }));
        else if (file.size > MAX_FILE_MB * 1024 * 1024) errors.add(t("msg.files.tooLarge", { name: file.name, max: MAX_FILE_MB }));
        else if (file.size === 0) errors.add(t("msg.files.empty", { name: file.name }));
        else if (accepted.length >= room) errors.add(t("msg.files.tooMany", { max: MAX_FILES }));
        else {
          const kind = fileKind(file.type || file.name);
          accepted.push({
            key: `draft-${++seq}`,
            file,
            name: file.name,
            size: file.size,
            kind,
            preview: kind === "image" ? URL.createObjectURL(file) : null,
            status: "uploading",
            progress: 0,
          });
        }
      }
      errors.forEach((e) => toast.error(e));
      if (accepted.length === 0) return;
      update((list) => [...list, ...accepted]);
      accepted.forEach((d) => start(d.key, d.file));
    },
    [start, t, update],
  );

  const remove = useCallback(
    (key: string) => {
      const d = box.current.list.find((x) => x.key === key);
      box.current.uploads.get(key)?.abort();
      if (d?.attachment) void messagesApi.deleteAttachment(d.attachment.id).catch(() => undefined);
      if (d?.preview) URL.revokeObjectURL(d.preview);
      update((list) => list.filter((x) => x.key !== key));
    },
    [update],
  );

  const retry = useCallback(
    (key: string) => {
      const d = box.current.list.find((x) => x.key === key);
      if (!d || d.status !== "failed") return;
      patch(key, { status: "uploading", progress: 0, error: undefined });
      start(key, d.file);
    },
    [patch, start],
  );

  /**
   * Hands the uploaded files to a message and empties the tray. They are its
   * files now: nothing here deletes them any more.
   */
  const take = useCallback(() => {
    const ready = box.current.list.filter((d) => d.status === "ready" && d.attachment).map((d) => d.attachment!);
    box.current.list.forEach((d) => d.preview && URL.revokeObjectURL(d.preview));
    update(() => []);
    return ready;
  }, [update]);

  // The composer goes away with files still in it: they were never sent.
  useEffect(() => {
    const b = box.current;
    return () => {
      b.uploads.forEach((c) => c.abort());
      b.list.forEach((d) => {
        if (d.attachment) void messagesApi.deleteAttachment(d.attachment.id).catch(() => undefined);
        if (d.preview) URL.revokeObjectURL(d.preview);
      });
      b.list = [];
    };
  }, []);

  return {
    drafts,
    add,
    remove,
    retry,
    take,
    uploading: drafts.some((d) => d.status === "uploading"),
    failed: drafts.some((d) => d.status === "failed"),
    ready: drafts.filter((d) => d.status === "ready").length,
  };
}

export type AttachmentDrafts = ReturnType<typeof useAttachmentDrafts>;

/**
 * An image's address for the page to show, fetched with the session. Not
 * under "messages": the realtime refresh of a chat would fetch every picture
 * again.
 */
export function useAttachmentUrl(id: string, enabled = true) {
  return useQuery({
    queryKey: ["message-file", id],
    queryFn: async () => URL.createObjectURL(await messagesApi.attachmentBlob(id, true)),
    staleTime: Infinity,
    gcTime: 10 * 60_000,
    retry: false,
    enabled,
  });
}

/** Saves a file under the name it was sent with. */
export function useDownloadAttachment() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<string | null>(null);
  const download = useCallback(
    async (a: MessageAttachment) => {
      setBusy(a.id);
      try {
        downloadBlob(await messagesApi.attachmentBlob(a.id), a.fileName);
      } catch (e) {
        toast.error(await blobErrorMessage(e, t("msg.files.downloadFailed")));
      } finally {
        setBusy(null);
      }
    },
    [t],
  );
  return { download, busy };
}

/** Deletes drafts a failed message was carrying, when it is discarded. */
export const forgetDrafts = (files?: MessageAttachment[]) =>
  files?.forEach((a) => void messagesApi.deleteAttachment(a.id).catch(() => undefined));
