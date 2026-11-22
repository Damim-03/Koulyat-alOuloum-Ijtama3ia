/**
 * حين تتعثّر القاعدة في منتصف الطلب: كلّ مسارٍ يُسلّم الخطأ لمعالج الأخطاء
 * (`next`) — لا يبتلعه، ولا يُسقط الخادم بوعدٍ مرفوضٍ بلا معالج.
 */
jest.mock("./supervision.service", () => ({
  previewSupervisionDocumentService: jest.fn(),
  issueSupervisionDocumentService: jest.fn(),
  getSupervisionDocumentService: jest.fn(),
  listSupervisionDocumentsService: jest.fn(),
  revokeSupervisionDocumentService: jest.fn(),
  verifySupervisionDocumentService: jest.fn(),
}));

import type { NextFunction, Request, Response } from "express";

import * as service from "./supervision.service";
import {
  getSupervisionDocumentController,
  issueSupervisionDocumentController,
  listSupervisionDocumentsController,
  previewSupervisionDocumentController,
  revokeSupervisionDocumentController,
  verifySupervisionDocumentController,
} from "./supervision.controller";

const ID = "00000000-0000-4000-8000-000000000000";
const user = { userId: "u1", role: "admin" };

const cases: [string, (req: Request, res: Response, next: NextFunction) => unknown, keyof typeof service, Partial<Request>][] = [
  ["preview", previewSupervisionDocumentController, "previewSupervisionDocumentService", { params: { topicId: ID } }],
  ["issue", issueSupervisionDocumentController, "issueSupervisionDocumentService", { params: { topicId: ID } }],
  ["read", getSupervisionDocumentController, "getSupervisionDocumentService", { params: { id: ID } }],
  ["list", listSupervisionDocumentsController, "listSupervisionDocumentsService", { query: {} }],
  ["revoke", revokeSupervisionDocumentController, "revokeSupervisionDocumentService", { params: { id: ID } }],
  ["verify", verifySupervisionDocumentController, "verifySupervisionDocumentService", { params: { token: "2900000000001" } }],
];

describe("supervision controllers — a failing database reaches the error handler", () => {
  it.each(cases)("%s", async (_name, controller, serviceName, req) => {
    const failure = new Error("db down");
    (service[serviceName] as jest.Mock).mockRejectedValueOnce(failure);
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
    const next = jest.fn();

    await controller({ ...req, user } as unknown as Request, res, next);

    expect(next).toHaveBeenCalledWith(failure);
    expect(res.status).not.toHaveBeenCalled();
  });
});
