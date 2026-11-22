/**
 * بثّ التغييرات — ما يُعلن بعد كتابةٍ ناجحة، وما لا يُعلن.
 *
 * كتابةٌ على جذر الوحدة نفسه (`POST /api/admin/`) لا تسمّي مورداً: لا يُبثّ
 * شيء، بدل أن يُبثّ «null» لكلّ متّصل.
 */
jest.mock("../realtime/realtime", () => ({ broadcastChange: jest.fn() }));

import { EventEmitter } from "node:events";
import type { Request, Response } from "express";

import { broadcastChange } from "../realtime/realtime";
import { realtimeBroadcast } from "./realtime.middleware";

function write(method: string, path: string, params: Record<string, string> = {}, status = 200) {
  const res = Object.assign(new EventEmitter(), { statusCode: status });
  const next = jest.fn();
  realtimeBroadcast({ method, path, params, originalUrl: `/api/admin${path}` } as unknown as Request, res as unknown as Response, next);
  res.emit("finish");
  return next;
}

describe("realtimeBroadcast", () => {
  beforeEach(() => jest.clearAllMocks());

  it("كتابةٌ على جذر الوحدة ⇒ لا مورد، فلا بثّ", () => {
    expect(write("POST", "/")).toHaveBeenCalled();
    expect(broadcastChange).not.toHaveBeenCalled();
  });

  it("معاينةٌ أو رسالةٌ تجريبية لا تغيّر شيئاً ⇒ لا بثّ (وإلّا أعادت المعاينةُ نفسَها بلا نهاية)", () => {
    for (const path of ["/mail-templates/preview", "/mail-templates/test", "/students/import/preview", "/topics/import/preview"])
      expect(write("POST", path)).toHaveBeenCalled();
    expect(broadcastChange).not.toHaveBeenCalled();
    // Saving them is a change.
    write("PUT", "/mail-templates");
    expect(broadcastChange).toHaveBeenCalledWith("mail-templates", "updated", undefined);
  });

  it("وكتابةٌ على مورد ⇒ يُبثّ تغييره، وتغيير لوحة الإحصاء إن مسّها", () => {
    write("DELETE", "/topics/t1", { id: "t1" });
    expect(broadcastChange).toHaveBeenCalledWith("topics", "deleted", "t1");
    expect(broadcastChange).toHaveBeenCalledWith("dashboard", "updated");
  });
});
