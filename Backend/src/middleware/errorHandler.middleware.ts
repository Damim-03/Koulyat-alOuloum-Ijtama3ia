import { ErrorRequestHandler, Request, Response, NextFunction } from "express";
import { HTTPSTATUS } from "../config/http/http.config";

export const errorHandler: ErrorRequestHandler = (
  error,
  req: Request,
  res: Response,
  next: NextFunction,
): any => {
  if (error instanceof SyntaxError) {
    return res.status(HTTPSTATUS.BAD_REQUEST).json({
      message: "Invalid JSON Format. please check your request body",
    });
  }
  return res.status(HTTPSTATUS.INTERNAL_SERVER_ERROR).json({
    message: "Internal Server Error",
    error: error?.message || "Unknown Error Occurred",
  });
};
