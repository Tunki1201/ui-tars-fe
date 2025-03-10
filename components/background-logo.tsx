export default function BackgroundLogo() {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
            <div className="flex items-center justify-center space-x-3 text-muted-foreground/5">
                <svg width="64" height="64" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="2" y="2" width="4.5" height="4.5" rx="1.25" fill="currentColor" />
                    <rect x="9.5" y="2" width="4.5" height="4.5" rx="1.25" fill="currentColor" />
                    <rect x="2" y="9.5" width="4.5" height="4.5" rx="1.25" fill="currentColor" />
                    <rect x="9.5" y="9.5" width="4.5" height="4.5" rx="1.25" fill="currentColor" />
                </svg>
          <span className="text-6xl font-medium">sentia</span>
        </div>
      </div>
    )
  }
    