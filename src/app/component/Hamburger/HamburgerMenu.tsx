// HamburgerMenu.tsx
import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars } from "@fortawesome/free-solid-svg-icons";

interface HamburgerMenuProps {
  isOpen: boolean;
  toggleMenu: () => void;
}

const HamburgerMenu: React.FC<HamburgerMenuProps> = ({
  isOpen,
  toggleMenu,
}) => {
  return (
    <div className="cursor-pointer p-1 justify-start" onClick={toggleMenu}>
      <FontAwesomeIcon icon={faBars} fontSize="50px" />
    </div>
  );
};

export default HamburgerMenu;