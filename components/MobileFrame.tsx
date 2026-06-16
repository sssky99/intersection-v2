export function MobileFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh justify-center bg-outer text-foreground">
      <main className="relative min-h-dvh w-full max-w-[430px] overflow-hidden bg-background md:my-4 md:min-h-[calc(100dvh-32px)] md:rounded-[32px] md:shadow-frame">
        {children}
      </main>
    </div>
  );
}
