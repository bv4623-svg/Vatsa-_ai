import { ReactNode } from "react";

interface MagneticProps {
  children: ReactNode;
  strength?: number;
}

export default function Magnetic({ children, strength = 0.25 }: MagneticProps) {
  return <>{children}</>;
}