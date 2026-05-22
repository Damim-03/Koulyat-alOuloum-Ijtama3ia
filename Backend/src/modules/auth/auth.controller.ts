import { Request, Response } from "express";

export const authController = async (req: Request, res: Response) => {
  return res.status(200).json({
    message: "Authenticated",
  });
};
