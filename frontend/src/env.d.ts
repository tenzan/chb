/// <reference types="astro/client" />

declare const __COMMIT_SHA__: string;

declare namespace App {
  interface Locals {
    user?: {
      id: string;
      email: string;
      name: string;
      roles: string[];
    };
  }
}
