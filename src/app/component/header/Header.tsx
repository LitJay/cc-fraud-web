"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import HamburgerMenu from "../Hamburger/HamburgerMenu";
import NavigationDrawer from "../Hamburger/NavigationDrawer";
import GeneralAlert, {
  AlertDialogCommand,
  AlertMode,
} from "../GeneralAlert/GeneralAlert";

const Header: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");
  const [inactivityTimer, setInactivityTimer] = useState<NodeJS.Timeout | null>(
    null
  );
  const router = useRouter();

  const isTokenExpired = (token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const expirationTime = payload.exp * 1000;
      return Date.now() >= expirationTime;
    } catch (error) {
      return true;
    }
  };

  const signOut = () => {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    localStorage.removeItem("token");
    localStorage.removeItem("userName");
    localStorage.removeItem("role");

    setLoggedIn(false);
    setUserName("");
    router.push("/login");
  };

  const handleExpiredToken = (text: string) => {
    GeneralAlert({
      mode: AlertMode.Error,
      text: text,
      callback: signOut,
    } as AlertDialogCommand);
  };

  useEffect(() => {
    const checkAuthState = () => {
      const token = localStorage.getItem("token");
      const name = localStorage.getItem("userName");
      const isLoginPage = window.location.pathname === "/login";

      if (token) {
        if (isTokenExpired(token)) {
          setLoggedIn(false);
          if (!isLoginPage) {
            handleExpiredToken(
              "Your session has expired. Please log in again."
            );
          }
        } else {
          setLoggedIn(true);
          setUserName(name ?? "");
        }
      } else {
        // No token found
        setLoggedIn(false);
        setUserName("");
        if (!isLoginPage) {
          handleExpiredToken("Please log in to continue.");
        }
      }
    };
    checkAuthState();
    window.addEventListener("storage", checkAuthState);

    return () => {
      window.removeEventListener("storage", checkAuthState);
    };
  }, [router]);

  useEffect(() => {
    if (!loggedIn) {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      return;
    }

    const resetInactivityTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);

      const newTimer = setTimeout(() => {
        handleExpiredToken("You have been logged out due to inactivity.");
      }, 10 * 60 * 1000);

      setInactivityTimer(newTimer);
    };

    resetInactivityTimer();

    const activityEvents: (keyof WindowEventMap)[] = [
      "mousemove",
      "keydown",
      "click",
      "scroll",
    ];
    activityEvents.forEach((event) =>
      window.addEventListener(event, resetInactivityTimer)
    );

    return () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      activityEvents.forEach((event) =>
        window.removeEventListener(event, resetInactivityTimer)
      );
    };
  }, [loggedIn]);

  const signOutConfirmation = () => {
    GeneralAlert({
      mode: AlertMode.ConfirmOrCancel,
      text: "Are you sure you want to sign out?",
      callback: signOut,
    } as AlertDialogCommand);
  };

  return (
    <header className="w-full flex items-center bg-black text-white p-3 relative z-10">
      <NavigationDrawer
        isOpen={drawerOpen}
        closeDrawer={() => setDrawerOpen(false)}
      />
      {loggedIn && (
        <HamburgerMenu
          isOpen={drawerOpen}
          toggleMenu={() => setDrawerOpen(!drawerOpen)}
        />
      )}
      <h1 className="flex-1 text-2xl font-bold pl-4 flex items-center">
       
        <img
          src="/logo.png"
          alt="Credit Card Fraud Detection System Logo"
          className="h-13 w-auto mr-2" 
        />
        <a href="/login">Credit Card Fraud Detection System</a>
      </h1>
      {loggedIn && (
        <div className="flex items-center space-x-4 text-lg">
          <span>Hello, {userName}</span>
          <button
            onClick={signOutConfirmation}
            className="px-3 py-1 rounded-md border border-white hover:bg-white hover:text-red-500 transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </header>
  );
};

export default Header;
