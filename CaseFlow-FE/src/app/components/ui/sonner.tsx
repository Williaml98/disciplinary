import { Toaster as Sonner, type ToasterProps } from 'sonner';

// Rewritten from the stock shadcn version, which read the theme from next-themes. Nothing in this app
// mounts a ThemeProvider and the UI is light-only, so that import was a dependency on a provider that
// never existed. Colours come from the brand navy rather than theme.css's stock shadcn --primary.
const NAVY = '#1D3A5F';

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        style: {
          borderRadius: '12px',
          fontSize: '14px',
        },
        classNames: {
          toast: 'shadow-lg',
          actionButton: 'rounded-lg',
        },
      }}
      style={{ ['--normal-border' as string]: `${NAVY}20` }}
      {...props}
    />
  );
}
