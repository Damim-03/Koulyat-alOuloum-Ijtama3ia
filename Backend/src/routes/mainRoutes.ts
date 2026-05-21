import { Router } from "express";

const mainRoute: Router = Router();

mainRoute.get("/", (req, res) => res.send("Hello World"));

export default mainRoute;