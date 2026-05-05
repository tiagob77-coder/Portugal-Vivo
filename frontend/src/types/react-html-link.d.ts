// React's LinkHTMLAttributes does not include hreflang — extend it here
// so that <link rel="alternate" hreflang="pt" href="..." /> compiles cleanly
// inside expo-router <Head> blocks.
import 'react';

declare module 'react' {
  interface LinkHTMLAttributes<T> {
    hreflang?: string;
  }
}
