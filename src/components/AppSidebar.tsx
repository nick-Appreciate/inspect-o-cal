import { Calendar, CheckSquare, FileText, List, Building2 } from "lucide-react";
import { NavLink } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Calendar", url: "/", icon: Calendar },
  { title: "My Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Properties", url: "/properties", icon: Building2 },
  { title: "Templates", url: "/templates", icon: FileText },
  { title: "Inspections", url: "/inspections", icon: List },
];

export function AppSidebar() {
  return (
    <Sidebar 
      collapsible="none" 
      className="border-r w-16 sticky top-0 h-screen"
    >
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
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
  );
}
