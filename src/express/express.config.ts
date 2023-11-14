import express, { Application } from "express";
import morgan from "morgan";
import bodyParser from "body-parser";
import compress from "compression";
import methodOverride from "method-override";
import cors from "cors";
import helmet from "helmet";

const ExpressConfig = (): Application => {
  const app = express();

  // request logging. dev: console | production: file
  const logs = process.env.NODE_ENV === "production" ? "combined" : "dev";
  app.use(morgan(logs));

  // parse body params and attach them to req.body
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  // gzip compression
  app.use(compress());

  // lets you use HTTP verbs such as PUT or DELETE
  // in places where the client doesn't support it
  app.use(methodOverride());

  // secure apps by setting various HTTP headers
  app.use(helmet());

  // enable CORS - Cross Origin Resource Sharing
  app.use(cors());

  return app;
};
export default ExpressConfig;
