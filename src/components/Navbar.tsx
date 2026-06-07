import { NavLink } from "./NavLink";
import { Film, Image, Sparkles } from "lucide-react";

const Navbar = () => {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-primary/10">
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
          </div>
          <div>
            <span className="font-bold tracking-tight text-foreground text-base block sm:inline">MediaSuite</span>
            <span className="text-xs text-muted-foreground ml-1.5 hidden sm:inline">| Creative Tools</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex items-center gap-2">
          <NavLink
            to="/"
            end
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            activeClassName="bg-secondary text-primary font-semibold shadow-sm border border-border/40"
          >
            <Film className="w-4 h-4" />
            <span className="hidden sm:inline">Video Grid Maker</span>
            <span className="sm:hidden">Video Grid</span>
          </NavLink>

          <NavLink
            to="/image-studio"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all text-muted-foreground hover:text-foreground hover:bg-secondary/50 relative"
            activeClassName="bg-secondary text-primary font-semibold shadow-sm border border-border/40"
          >
            <Image className="w-4 h-4" />
            <span className="hidden sm:inline">Image Studio</span>
            <span className="sm:hidden">Image Studio</span>
            <span className="absolute -top-1.5 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
          </NavLink>
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
