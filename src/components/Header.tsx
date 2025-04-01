"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { LoginButton } from "./auth/LoginButton";
import ThemeToggle from "@/theme/theme-toggle";
import Link from "next/link";
import ManifestLink from "./ManifestLink";

export default function Header() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex-shrink-0">
            <h1
              className="text-xl font-bold text-gray-900 dark:text-white 
              sm:text-2xl md:text-3xl"
            >
              <Link href="/">IIIF Annotator</Link>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <ManifestLink />
            <ThemeToggle />
            <LoginButton user={user} loading={loading} />
          </div>
        </div>
      </div>
    </header>
  );
}
