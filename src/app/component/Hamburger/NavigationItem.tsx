import { useRouter } from "next/router";
import Link from "next/link";
import React from "react";

interface NavigationItemProps {
  href: string;
  children: React.ReactNode;
}

const NavigationItem: React.FC<NavigationItemProps> = ({ href, children }) => {
  const router = useRouter();
  const isActive = router.pathname === href;

  return (
    <li className={isActive ? "active" : ""}>
      <Link href={href}>{children}</Link>
    </li>
  );
};

export default NavigationItem;
