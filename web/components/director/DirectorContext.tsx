"use client";

import { createContext, useContext } from "react";

export type DirectorActions = {
  /** Opens the Director panel and asks a free-form question. */
  ask: (question: string) => void;
  /** Opens the Director panel without sending anything. */
  open: () => void;
};

const Ctx = createContext<DirectorActions>({ ask: () => {}, open: () => {} });

export const DirectorProvider = Ctx.Provider;
export const useDirector = () => useContext(Ctx);
