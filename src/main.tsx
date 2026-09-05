import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { useEditorStore } from "./store/building";
import { startPersistence } from "./store/persist";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

startPersistence(useEditorStore);

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
