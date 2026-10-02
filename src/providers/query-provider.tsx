"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";

type Props = {
  children?: React.ReactNode;
};

export const QueryProvider = ({ children }: Props) => {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
};
