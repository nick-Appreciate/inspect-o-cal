import { Calendar, CheckSquare, FileText, List, Building2, Menu } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const menuItems = [
  { title: "Calendar", url: "/", icon: Calendar },
  { title: "My Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Properties", url: "/properties", icon: Building2 },
  { title: "Templates", url: "/templates", icon: FileText },
  { title: "Inspections", url: "/inspections", icon: List },
];

export function AppSidebar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Desktop Sidebar - Left side */}
      <Sidebar 
        collapsible="none" 
        className="hidden md:flex border-r w-16 sticky top-0 h-screen"
      >
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {menuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={{ children: item.title, hidden: false }}>
                      <NavLink
                        to={item.url}
                        end
                        className={({ isActive }) =>
                          `flex items-center justify-center transition-colors duration-200 ${
                            isActive
                              ? "bg-accent text-accent-foreground"
                              : "hover:bg-accent/50"
                          }`
                        }
                      >
                        <item.icon className="h-5 w-5" />
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      {/* Mobile Bottom Navigation - Hamburger Button */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
        <Button
          variant="ghost"
          onClick={() => setIsOpen(true)}
          className="w-full rounded-none h-12 flex items-center justify-center"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Mobile Navigation Sheet */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="bottom" className="h-auto">
          <SheetHeader>
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-3 mt-6 pb-4">
            {menuItems.map((item) => (
              <NavLink
                key={item.title}
                to={item.url}
                end
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-2 p-4 rounded-lg border transition-colors ${
                    isActive
                      ? "bg-accent text-accent-foreground border-accent-foreground/20"
                      : "hover:bg-accent/50 border-border"
                  }`
                }
              >
                <item.icon className="h-6 w-6" />
                <span className="text-sm font-medium">{item.title}</span>
              </NavLink>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
