import Link from "next/link";

export function Navbar() {
  return (
    <nav className="w-full py-8 flex justify-center items-center">
      <Link href="/" className="text-xl font-bold tracking-tight text-primary hover:opacity-80 transition-opacity">
        Amply
      </Link>
    </nav>
  );
}
