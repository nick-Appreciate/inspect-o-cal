import { Calendar, CheckSquare, FileText, List, Building2, ChevronUp } from "lucide-react";
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

const menuItems = [
  { title: "Calendar", url: "/", icon: Calendar },
  { title: "My Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Properties", url: "/properties", icon: Building2 },
  { title: "Templates", url: "/templates", icon: FileText },
  { title: "Inspections", url: "/inspections", icon: List },
];

export function AppSidebar() {
  const [isExpanded, setIsExpanded] = useState(false);

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

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        {/* Expandable Menu */}
        {isExpanded && (
          <div className="bg-background border-t border-border shadow-lg">
            <div className="grid grid-cols-5 gap-1 p-2">
              {menuItems.map((item) => (
                <NavLink
                  key={item.title}
                  to={item.url}
                  end
                  onClick={() => setIsExpanded(false)}
                  className={({ isActive }) =>
                    `flex flex-col items-center justify-center gap-1 p-3 rounded-lg transition-colors ${
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50"
                    }`
                  }
                >
                  <item.icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{item.title}</span>
                </NavLink>
              ))}
            </div>
          </div>
        )}

        {/* Toggle Button */}
        <div className="bg-background border-t border-border">
          <Button
            variant="ghost"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full rounded-none h-14 flex items-center justify-center gap-2"
          >
            <ChevronUp className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            <span className="text-sm font-medium">Menu</span>
          </Button>
        </div>
      </div>
    </>
  );
}
