import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet } from "lucide-react";

const Navbar = () => {
    const { pathname } = useLocation();
    const isLanding = pathname === "/";

    return (
        <header className="sticky top-0 z-50 border-b-4 border-black bg-background">
            <nav className="container mx-auto flex items-center justify-between px-4 py-4">
                {/* Logo */}
                <Link to="/" className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center border-4 border-black bg-primary shadow-2xs">
                        <FileSpreadsheet className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <span className="font-mono text-xl font-bold">ExcelAI Pro</span>
                </Link>

                {/* Nav Links */}
                <div className="hidden items-center gap-6 md:flex">
                    {isLanding ? (
                        <>
                            <a href="#features" className="font-medium hover:text-primary">
                                Features
                            </a>
                            <a href="#how-it-works" className="font-medium hover:text-primary">
                                How It Works
                            </a>
                            <a href="#use-cases" className="font-medium hover:text-primary">
                                Use Cases
                            </a>
                        </>
                    ) : (
                        <>
                            <Link to="/#features" className="font-medium hover:text-primary">
                                Features
                            </Link>
                            <Link to="/#how-it-works" className="font-medium hover:text-primary">
                                How It Works
                            </Link>
                            <Link to="/#use-cases" className="font-medium hover:text-primary">
                                Use Cases
                            </Link>
                        </>
                    )}

                    <Link to="/pricing" className="font-medium hover:text-primary">
                        Pricing
                    </Link>
                </div>

                {/* CTA */}
                <Button 
                    size="lg" 
                    className="font-mono font-bold"
                    onClick={() => window.location.href = '/auth'}
                >
                    Start Free Trial
                </Button>
            </nav>
        </header>
    );
};

export default Navbar;
