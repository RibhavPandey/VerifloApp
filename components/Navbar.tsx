import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import VerifloLogo from "./VerifloLogo";
import { useState } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Navbar = () => {
    const { pathname } = useLocation();
    const isLanding = pathname === "/";
    const isPricing = pathname === "/pricing";
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    
    const textColor = isPricing ? "text-[#7f9ddf]" : "text-white";
    const hoverColor = isPricing ? "hover:text-[#7f9ddf]/80" : "hover:text-white/80";
    const containerBg = isPricing ? "bg-white backdrop-blur-md" : "bg-white/10 backdrop-blur-md";
    const containerBorder = isPricing ? "border-gray-200" : "border-white/20";
    const logoBg = isPricing ? "bg-[#7f9ddf]/10" : "bg-white/20";

    return (
        <header className="sticky top-0 z-50 w-full">
            <nav className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div className={`flex items-center justify-between ${containerBg} rounded-2xl px-6 py-3 shadow-sm border ${containerBorder}`}>
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-2">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${logoBg} backdrop-blur-sm shadow-sm`}>
                            <VerifloLogo size={24} />
                        </div>
                        <span className={`text-xl font-bold ${textColor}`}>Veriflo</span>
                    </Link>

                    {/* Desktop Nav Links */}
                    <div className="hidden items-center gap-8 lg:flex">
                        {isLanding ? (
                            <>
                                <DropdownMenu>
                                    <DropdownMenuTrigger className={`flex items-center gap-1 text-sm font-medium ${textColor} ${hoverColor} transition-colors outline-none`}>
                                        Features
                                        <ChevronDown className="h-4 w-4" />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-48">
                                        <DropdownMenuItem asChild>
                                            <a href="#features" className="cursor-pointer">All Features</a>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                            <a href="#comparison" className="cursor-pointer">Why Veriflo</a>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                            <a href="#how-it-works" className="cursor-pointer">How It Works</a>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                            <a href="#use-cases" className="cursor-pointer">Use Cases</a>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <a href="#comparison" className={`text-sm font-medium ${textColor} ${hoverColor} transition-colors`}>
                                    Why Veriflo
                                </a>
                                <a href="#how-it-works" className={`text-sm font-medium ${textColor} ${hoverColor} transition-colors`}>
                                    How It Works
                                </a>
                                <a href="#use-cases" className={`text-sm font-medium ${textColor} ${hoverColor} transition-colors`}>
                                    Use Cases
                                </a>
                            </>
                        ) : (
                            <>
                                <DropdownMenu>
                                    <DropdownMenuTrigger className={`flex items-center gap-1 text-sm font-medium ${textColor} ${hoverColor} transition-colors outline-none`}>
                                        Features
                                        <ChevronDown className="h-4 w-4" />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-48">
                                        <DropdownMenuItem 
                                            onClick={() => window.location.href = '/#features'}
                                            className="cursor-pointer"
                                        >
                                            All Features
                                        </DropdownMenuItem>
                                        <DropdownMenuItem 
                                            onClick={() => window.location.href = '/#comparison'}
                                            className="cursor-pointer"
                                        >
                                            Why Veriflo
                                        </DropdownMenuItem>
                                        <DropdownMenuItem 
                                            onClick={() => window.location.href = '/#how-it-works'}
                                            className="cursor-pointer"
                                        >
                                            How It Works
                                        </DropdownMenuItem>
                                        <DropdownMenuItem 
                                            onClick={() => window.location.href = '/#use-cases'}
                                            className="cursor-pointer"
                                        >
                                            Use Cases
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <Link 
                                    to="/" 
                                    onClick={(e) => {
                                        e.preventDefault();
                                        window.location.href = '/#comparison';
                                    }}
                                    className={`text-sm font-medium ${textColor} ${hoverColor} transition-colors`}
                                >
                                    Why Veriflo
                                </Link>
                                <Link 
                                    to="/" 
                                    onClick={(e) => {
                                        e.preventDefault();
                                        window.location.href = '/#how-it-works';
                                    }}
                                    className={`text-sm font-medium ${textColor} ${hoverColor} transition-colors`}
                                >
                                    How It Works
                                </Link>
                                <Link 
                                    to="/" 
                                    onClick={(e) => {
                                        e.preventDefault();
                                        window.location.href = '/#use-cases';
                                    }}
                                    className={`text-sm font-medium ${textColor} ${hoverColor} transition-colors`}
                                >
                                    Use Cases
                                </Link>
                            </>
                        )}

                        <Link to="/pricing" className={`text-sm font-medium ${textColor} ${hoverColor} transition-colors`}>
                            Pricing
                        </Link>
                    </div>

                    {/* Right Side - Login & CTA */}
                    <div className="hidden items-center gap-4 lg:flex">
                        <Link to="/auth" className={`text-sm font-medium ${textColor} ${hoverColor} transition-colors`}>
                            Log in
                        </Link>
                        <Button 
                            size="lg" 
                            className="bg-white text-[#7f9ddf] hover:bg-white/90 font-semibold rounded-xl px-6 shadow-lg transition-all"
                            onClick={() => window.location.href = '/auth'}
                        >
                            Start Free Trial
                        </Button>
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        className={`lg:hidden p-2 ${textColor} ${hoverColor} transition-colors`}
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label="Toggle menu"
                    >
                        {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                    </button>
                </div>

                {/* Mobile Menu */}
                {mobileMenuOpen && (
                    <div className="lg:hidden mt-4 bg-white/90 backdrop-blur-md rounded-2xl shadow-lg border border-gray-100 p-6">
                        <div className="flex flex-col gap-4">
                            {isLanding ? (
                                <>
                                    <a href="#features" className="text-sm font-medium text-gray-700 hover:text-primary transition-colors" onClick={() => setMobileMenuOpen(false)}>
                                        Features
                                    </a>
                                    <a href="#comparison" className="text-sm font-medium text-gray-700 hover:text-primary transition-colors" onClick={() => setMobileMenuOpen(false)}>
                                        Why Veriflo
                                    </a>
                                    <a href="#how-it-works" className="text-sm font-medium text-gray-700 hover:text-primary transition-colors" onClick={() => setMobileMenuOpen(false)}>
                                        How It Works
                                    </a>
                                    <a href="#use-cases" className="text-sm font-medium text-gray-700 hover:text-primary transition-colors" onClick={() => setMobileMenuOpen(false)}>
                                        Use Cases
                                    </a>
                                </>
                            ) : (
                                <>
                                    <Link 
                                        to="/" 
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setMobileMenuOpen(false);
                                            window.location.href = '/#features';
                                        }}
                                        className="text-sm font-medium text-gray-700 hover:text-primary transition-colors"
                                    >
                                        Features
                                    </Link>
                                    <Link 
                                        to="/" 
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setMobileMenuOpen(false);
                                            window.location.href = '/#comparison';
                                        }}
                                        className="text-sm font-medium text-gray-700 hover:text-primary transition-colors"
                                    >
                                        Why Veriflo
                                    </Link>
                                    <Link 
                                        to="/" 
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setMobileMenuOpen(false);
                                            window.location.href = '/#how-it-works';
                                        }}
                                        className="text-sm font-medium text-gray-700 hover:text-primary transition-colors"
                                    >
                                        How It Works
                                    </Link>
                                    <Link 
                                        to="/" 
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setMobileMenuOpen(false);
                                            window.location.href = '/#use-cases';
                                        }}
                                        className="text-sm font-medium text-gray-700 hover:text-primary transition-colors"
                                    >
                                        Use Cases
                                    </Link>
                                </>
                            )}
                            <Link to="/pricing" className="text-sm font-medium text-gray-700 hover:text-primary transition-colors" onClick={() => setMobileMenuOpen(false)}>
                                Pricing
                            </Link>
                            <div className="pt-4 border-t border-gray-200 flex flex-col gap-3">
                                <Link to="/auth" className="text-sm font-medium text-gray-700 hover:text-primary transition-colors" onClick={() => setMobileMenuOpen(false)}>
                                    Log in
                                </Link>
                                <Button 
                                    size="lg" 
                                    className="w-full bg-primary text-white hover:bg-primary/90 font-semibold rounded-xl shadow-sm"
                                    onClick={() => {
                                        setMobileMenuOpen(false);
                                        window.location.href = '/auth';
                                    }}
                                >
                                    Start Free Trial
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </nav>
        </header>
    );
};

export default Navbar;
