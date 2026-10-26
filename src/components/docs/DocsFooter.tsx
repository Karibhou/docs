"use client";

import { useEffect, useState, FormEvent } from "react";
import Image from "next/image";
import { GridLines, StarField } from "../index";
import Link from "next/link";
import { useTheme } from "next-themes";

const SECURITY_POLICY_URL =
  "https://github.com/hivecommons/.github/blob/main/SECURITY.md";

export const POLICY_LINKS = [
  {
    label: "Apache 2.0 License",
    href: "https://github.com/hivecommons/docs/blob/main/LICENSE",
  },
  { label: "Security Policy", href: SECURITY_POLICY_URL },
  {
    label: "Security Contacts",
    href: `${SECURITY_POLICY_URL}#reporting-a-vulnerability`,
  },
] as const;

export default function Footer() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [email, setEmail] = useState("");

  const handleSubscribe = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    window.alert("Subscriptions are not available yet. Please try again later.");
    setEmail("");
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Back to top functionality
    const backToTopButton = document.getElementById("back-to-top");
    if (!backToTopButton) return;

    const toggleButton = () => {
      if (window.scrollY > 300) {
        backToTopButton.style.opacity = "1";
        backToTopButton.style.transform = "translateY(-30px)";
      } else {
        backToTopButton.style.opacity = "0";
        backToTopButton.style.transform = "translateY(10px)";
      }
    };

    const handleClick = () => {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    };

    window.addEventListener("scroll", toggleButton);
    backToTopButton.addEventListener("click", handleClick);

    // Initial check
    toggleButton();

    // Cleanup function to prevent memory leaks
    return () => {
      window.removeEventListener("scroll", toggleButton);
      backToTopButton.removeEventListener("click", handleClick);
    };
  }, [mounted]);

  // Prevent hydration mismatch by rendering dark theme until mounted
  if (!mounted) {
    return (
      <footer className="bg-bg text-ink border-t border-line relative overflow-hidden pt-8 sm:pt-12 md:pt-16 pb-6 sm:pb-8">
        <div className="absolute inset-0 bg-bg"></div>
        <StarField density="low" showComets={true} cometCount={2} />
        <GridLines horizontalLines={21} verticalLines={15} />
        <div className="absolute inset-0 z-0">
          <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-honey/10 to-transparent"></div>
          <div className="absolute top-0 right-0 w-full h-1/2 bg-gradient-to-b from-honey-deep/10 to-transparent"></div>
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-10 gap-6 sm:gap-4 lg:gap-12 mb-8 sm:mb-10 lg:mb-12">
            <div className="col-span-1 sm:col-span-3 lg:col-span-4 mb-4 sm:mb-0">
              <div className="flex items-center space-x-2 mb-3 sm:mb-4">
                <Image
                  src="/hive-commons-logo.png"
                  alt="Hive Commons logo"
                  width={40}
                  height={40}
                  className="h-8 sm:h-9 md:h-10 w-auto"
                />
              </div>
              <p className="text-ink-2 mb-4 sm:mb-6 leading-relaxed text-base sm:text-base">
                Hive Commons is an open source home for projects that help AI coding
                agents and maintainers work together with governance, auditability,
                and accountability.
              </p>
            </div>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className={`relative overflow-hidden pt-8 sm:pt-12 md:pt-16 pb-6 sm:pb-8 ${
      isDark
        ? 'bg-bg text-ink border-t border-line'
        : 'bg-bg text-ink border-t border-line'
    }`}>
      {/* Base background */}
      <div className={`absolute inset-0 ${isDark ? 'bg-bg' : 'bg-bg/80'}`}></div>

      {/* Starfield background */}
      <StarField density="low" showComets={true} cometCount={2} />

      {/* Grid lines background */}
      <GridLines horizontalLines={21} verticalLines={15} />

      {/* Background elements */}
      <div className="absolute inset-0 z-0">
        <div className={`absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t ${
          isDark ? 'from-honey/10' : 'from-honey/20'
        } to-transparent`}></div>
        <div className={`absolute top-0 right-0 w-full h-1/2 bg-gradient-to-b ${
          isDark ? 'from-honey-deep/10' : 'from-honey-deep/20'
        } to-transparent`}></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main footer content */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-10 gap-6 sm:gap-4 lg:gap-12 mb-8 sm:mb-10 lg:mb-12">
          {/* Brand Section */}
          <div className="col-span-1 sm:col-span-3 lg:col-span-4 mb-4 sm:mb-0">
            <div className="flex items-center space-x-2 mb-3 sm:mb-4">
              <Image
                src="/hive-commons-logo.png"
                alt="Hive Commons logo"
                width={40}
                height={40}
                className="h-8 sm:h-9 md:h-10 w-auto"
              />
            </div>
            <p className={`mb-4 sm:mb-6 leading-relaxed text-base sm:text-base ${
              isDark ? 'text-ink-2' : 'text-ink-2'
            }`}>
              Hive Commons is an open source home for projects that help AI coding
              agents and maintainers work together with governance, auditability,
              and accountability.
            </p>
            <div className="flex space-x-3 sm:space-x-4">
              <a
                href="https://github.com/hivecommons"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center transition-all duration-300"
                aria-label="Hive Commons on GitHub"
              >
                <svg
                  className={`w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 transition-all duration-300 ${
                    isDark
                      ? 'group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]'
                      : 'group-hover:drop-shadow-[0_0_8px_rgba(0,0,0,0.3)]'
                  }`}
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    className={`transition-colors duration-300 ${
                      isDark
                        ? 'text-ink-3 group-hover:text-ink'
                        : 'text-ink-2 group-hover:text-ink'
                    }`}
                    d="M12 0C5.374 0 0 5.373 0 12 0 17.302 3.438 21.8 8.207 23.387c.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.300 24 12c0-6.627-5.373-12-12-12z"
                  />
                </svg>
              </a>
              <a
                href="https://hivecommons.dev/tv"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center transition-all duration-300"
                aria-label="Hive Commons on YouTube"
              >
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 transition-all duration-300 group-hover:drop-shadow-[0_0_8px_rgba(255,0,0,0.8)]"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    className={`transition-colors duration-300 ${
                      isDark ? 'text-ink-3' : 'text-ink-2'
                    } group-hover:text-[#FF0000]`}
                    d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"
                  />
                </svg>
              </a>
              <a
                href="https://hivecommons.dev/discord"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center transition-all duration-300"
                aria-label="Hive Commons Discord"
              >
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 transition-all duration-300 group-hover:drop-shadow-[0_0_8px_rgba(88,101,242,0.8)]"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    className={`transition-colors duration-300 ${
                      isDark ? 'text-ink-3' : 'text-ink-2'
                    } group-hover:text-[#5865F2]`}
                    d="M20.317 4.37A19.791 19.791 0 0016.558 3c-.163.29-.35.682-.48.992a18.27 18.27 0 00-4.156 0A9.705 9.705 0 0011.442 3a19.736 19.736 0 00-3.76 1.372C5.305 7.94 4.658 11.42 4.98 14.85A19.9 19.9 0 009.58 17.2c.372-.51.704-1.05.988-1.616a12.933 12.933 0 01-1.558-.746c.13-.096.258-.195.382-.296 3.006 1.41 6.268 1.41 9.238 0 .125.101.253.2.383.296-.497.293-1.018.543-1.56.746.284.566.615 1.107.987 1.616a19.86 19.86 0 004.601-2.35c.378-3.975-.646-7.423-2.724-10.48zM10.61 12.74c-.902 0-1.64-.84-1.64-1.87 0-1.031.722-1.872 1.64-1.872.917 0 1.654.85 1.64 1.871 0 1.03-.723 1.87-1.64 1.87zm5.78 0c-.902 0-1.64-.84-1.64-1.87 0-1.031.722-1.872 1.64-1.872.917 0 1.654.85 1.64 1.871 0 1.03-.723 1.87-1.64 1.87z"
                  />
                </svg>
              </a>
            </div>
          </div>


          {/* Navigation Links Container */}
          <div className="col-span-1 sm:col-span-3 lg:col-span-6 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-4 lg:gap-8">
            {/* Project Links */}
            <div>
              <h3 className={`text-sm sm:text-base md:text-lg font-semibold mb-2 sm:mb-4 ${
                isDark ? 'text-ink' : 'text-ink'
              }`}>
                Projects
              </h3>
              <ul className="space-y-1 sm:space-y-3">
                <li>
                  <Link
                    href="/docs/hive/overview/introduction"
                    className={`text-xs sm:text-sm transition-colors duration-200 inline-block ${
                      isDark
                        ? 'text-ink-3 hover:text-ink'
                        : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    Hive
                  </Link>
                </li>
                <li>
                  <Link
                    href="/docs/hotshot/overview/introduction"
                    className={`text-xs sm:text-sm transition-colors duration-200 inline-block ${
                      isDark
                        ? 'text-ink-3 hover:text-ink'
                        : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    hotshot
                  </Link>
                </li>
                <li>
                  <Link
                    href="/docs/pluk/overview/introduction"
                    className={`text-xs sm:text-sm transition-colors duration-200 inline-block ${
                      isDark
                        ? 'text-ink-3 hover:text-ink'
                        : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    pluk
                  </Link>
                </li>
                <li>
                  <Link
                    href="/docs/rationguard/overview/introduction"
                    className={`text-xs sm:text-sm transition-colors duration-200 inline-block ${
                      isDark
                        ? 'text-ink-3 hover:text-ink'
                        : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    rationguard
                  </Link>
                </li>
                <li>
                  <Link
                    href="/docs/promptargs/overview/introduction"
                    className={`text-xs sm:text-sm transition-colors duration-200 inline-block ${
                      isDark
                        ? 'text-ink-3 hover:text-ink'
                        : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    promptargs
                  </Link>
                </li>
                <li>
                  <Link
                    href="/docs/crux/overview/introduction"
                    className={`text-xs sm:text-sm transition-colors duration-200 inline-block ${
                      isDark
                        ? 'text-ink-3 hover:text-ink'
                        : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    Crux
                  </Link>
                </li>
                <li>
                  <Link
                    href="/docs/spektacular/overview/introduction"
                    className={`text-xs sm:text-sm transition-colors duration-200 inline-block ${
                      isDark
                        ? 'text-ink-3 hover:text-ink'
                        : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    Spektacular
                  </Link>
                </li>
                <li>
                  <Link
                    href="/docs/dibs/overview/introduction"
                    className={`text-xs sm:text-sm transition-colors duration-200 inline-block ${
                      isDark
                        ? 'text-ink-3 hover:text-ink'
                        : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    dibs
                  </Link>
                </li>
              </ul>
            </div>

            {/* Get Started Links */}
            <div>
              <h3 className={`text-sm sm:text-base md:text-lg font-semibold mb-2 sm:mb-4 ${
                isDark ? 'text-ink' : 'text-ink'
              }`}>
                Get started
              </h3>
              <ul className="space-y-1 sm:space-y-3">
                <li>
                  <Link
                    href="/docs/hive/getting-started"
                    className={`text-xs sm:text-sm transition-colors duration-200 inline-block ${
                      isDark
                        ? 'text-ink-3 hover:text-ink'
                        : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    Hive getting started
                  </Link>
                </li>
                <li>
                  <Link
                    href="/docs/community/what-is-hive-commons"
                    className={`text-xs sm:text-sm transition-colors duration-200 inline-block ${
                      isDark
                        ? 'text-ink-3 hover:text-ink'
                        : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    What is Hive Commons?
                  </Link>
                </li>
                <li>
                  <Link
                    href="/docs/community/join-hive-commons"
                    className={`text-xs sm:text-sm transition-colors duration-200 inline-block ${
                      isDark
                        ? 'text-ink-3 hover:text-ink'
                        : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    Join Hive Commons
                  </Link>
                </li>
                <li>
                  <a
                    href="https://github.com/hivecommons/.github/blob/main/CONTRIBUTING.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-xs sm:text-sm transition-colors duration-200 inline-block ${
                      isDark
                        ? 'text-ink-3 hover:text-ink'
                        : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    Contributing
                  </a>
                </li>
              </ul>
            </div>

            {/* Community Links */}
            <div>
              <h3 className={`text-sm sm:text-base md:text-lg font-semibold mb-2 sm:mb-4 ${
                isDark ? 'text-ink' : 'text-ink'
              }`}>
                Community
              </h3>
              <ul className="space-y-1 sm:space-y-3">
                <li>
                  <Link
                    href="/docs/community/meetings"
                    className={`text-xs sm:text-sm transition-colors duration-200 inline-block ${
                      isDark
                        ? 'text-ink-3 hover:text-ink'
                        : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    Community meetings
                  </Link>
                </li>
                <li>
                  <a
                    href="https://hivecommons.dev/join"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-xs sm:text-sm transition-colors duration-200 inline-block ${
                      isDark
                        ? 'text-ink-3 hover:text-ink'
                        : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    Mailing list
                  </a>
                </li>
                <li>
                  <a
                    href="https://hivecommons.dev/discord"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-xs sm:text-sm transition-colors duration-200 inline-block ${
                      isDark
                        ? 'text-ink-3 hover:text-ink'
                        : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    Discord
                  </a>
                </li>
                <li>
                  <a
                    href="https://hivecommons.dev/tv"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-xs sm:text-sm transition-colors duration-200 inline-block ${
                      isDark
                        ? 'text-ink-3 hover:text-ink'
                        : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    YouTube
                  </a>
                </li>
              </ul>
            </div>

            {/* Resources Links */}
            <div>
              <h3 className={`text-sm sm:text-base md:text-lg font-semibold mb-2 sm:mb-4 ${
                isDark ? 'text-ink' : 'text-ink'
              }`}>
                Resources
              </h3>
              <ul className="space-y-1 sm:space-y-3">
                <li>
                  <a
                    href="https://hive.hivecommons.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-xs sm:text-sm transition-colors duration-200 inline-block ${
                      isDark
                        ? 'text-ink-3 hover:text-ink'
                        : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    Live Demo
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/hivecommons"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-xs sm:text-sm transition-colors duration-200 inline-block ${
                      isDark
                        ? 'text-ink-3 hover:text-ink'
                        : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    GitHub
                  </a>
                </li>
                <li>
                  <a
                    href="https://hivecommons.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-xs sm:text-sm transition-colors duration-200 inline-block ${
                      isDark
                        ? 'text-ink-3 hover:text-ink'
                        : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    Website
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:security@hivecommons.dev"
                    className={`text-xs sm:text-sm transition-colors duration-200 inline-block ${
                      isDark
                        ? 'text-ink-3 hover:text-ink'
                        : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    Security
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Newsletter Section */}
        <div className="flex flex-col items-center md:items-end justify-center w-full mb-6 sm:mb-8">
          <div className="w-full max-w-3xl lg:pr-28">
            <div className="flex flex-col md:flex-row items-center md:items-center justify-between lg:pl-12 gap-4 mb-4">
              {/* Title */}
              <div className="flex items-center justify-center w-full md:w-auto text-center md:text-left">
                <h3 className={`text-sm sm:text-sm md:text-base font-semibold uppercase tracking-wide whitespace-nowrap ${
                  isDark ? 'text-ink' : 'text-ink'
                }`}>
                  Stay Updated
                </h3>
              </div>

              {/* Form container */}
              <div className="flex-1 w-full md:w-auto">
                <form
                  id="newsletter-form"
                  onSubmit={handleSubscribe}
                  className="flex flex-col sm:flex-row gap-3 items-center w-full sm:w-auto"
                >
                  <div className="relative flex-1 w-full min-w-[260px] sm:min-w-[280px] md:min-w-[300px]">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 text-ink-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                    </div>

                    <input
                      id="email-address"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`block w-full pl-10 pr-3 py-3 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-honey focus:border-honey transition-colors duration-200 ${
                        isDark
                          ? 'text-ink placeholder-ink-3 bg-bg-2 border-line'
                          : 'text-ink placeholder-ink-3 bg-bg-2 border-line'
                      }`}
                      placeholder="Email"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className={`w-full sm:w-auto px-6 py-3 text-sm font-medium text-ink bg-honey border border-honey text-honey-ink rounded-lg shadow-sm hover:bg-honey-deep hover:border-honey-deep focus:outline-none focus:ring-2 focus:ring-honey focus:ring-offset-2 transition-all duration-200 transform hover:-translate-y-0.5 whitespace-nowrap ${
                      'focus:ring-offset-bg'
                    }`}
                  >
                    <span>Subscribe</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* Divider and bottom section */}
        <div className={`border-t pt-4 sm:pt-6 md:pt-8 ${
          'border-line'
        }`}>
          <div className="flex flex-col md:flex-row justify-between items-center gap-3 sm:gap-4">
            {/* Left side - copyright */}
            <p className={`text-xs sm:text-sm text-center md:text-left order-2 md:order-1 ${
              isDark ? 'text-ink-3' : 'text-ink-2'
            }`}>
              © {new Date().getFullYear()} Hive Commons. All rights reserved. Apache 2.0 Licence
            </p>

            {/* Right side - policy links. These pages are not published on
                the docs site, so point at the canonical files on GitHub. */}
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 md:gap-6 lg:gap-8 order-1 md:order-2">
              {POLICY_LINKS.map(link => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-xs sm:text-sm transition-colors duration-300 whitespace-nowrap ${
                    isDark
                      ? 'text-ink-3 hover:text-ink'
                      : 'text-ink-2 hover:text-ink'
                  }`}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating back to top button */}
      <button
        id="back-to-top"
        className="fixed bottom-18 right-8 p-3 rounded-full bg-honey text-honey-ink shadow-lg z-40 transition-all duration-300 opacity-0 translate-y-10 hover:bg-honey-deep hover:scale-110"
        aria-label="Back to top"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 sm:h-5 sm:w-5 md:h-6 md:w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 10l7-7m0 0l7 7m-7-7v18"
          />
        </svg>
      </button>
    </footer>
  );
}