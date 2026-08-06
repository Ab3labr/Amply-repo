import { ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
}

export function PageContainer({ children }: PageContainerProps) {
  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-6 max-w-5xl mx-auto w-full relative">
      {children}
    </div>
  );
}
