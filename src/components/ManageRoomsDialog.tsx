import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RoomTemplate {
  id: string;
  name: string;
  created_at: string;
}

interface ManageRoomsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageRoomsDialog({ open, onOpenChange }: ManageRoomsDialogProps) {
  const [rooms, setRooms] = useState<RoomTemplate[]>([]);
  const [newRoomName, setNewRoomName] = useState("");
  const [deleteRoomId, setDeleteRoomId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchRooms();
    }
  }, [open]);

  const fetchRooms = async () => {
    const { data, error } = await supabase
      .from("room_templates" as any)
      .select("*")
      .order("name");

    if (error) {
      toast.error("Failed to load room templates");
      return;
    }

    setRooms(data as any || []);
  };

  const addRoom = async () => {
    if (!newRoomName.trim()) {
      toast.error("Please enter a room name");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("room_templates" as any)
      .insert({
        name: newRoomName.trim(),
        created_by: user.id,
      });

    if (error) {
      toast.error("Failed to create room template");
      return;
    }

    setNewRoomName("");
    fetchRooms();
    toast.success("Room template created");
  };

  const deleteRoom = async () => {
    if (!deleteRoomId) return;

    const { error } = await supabase
      .from("room_templates" as any)
      .delete()
      .eq("id", deleteRoomId);

    if (error) {
      toast.error("Failed to delete room template");
      return;
    }

    setRooms(rooms.filter(r => r.id !== deleteRoomId));
    setDeleteRoomId(null);
    toast.success("Room template deleted");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Manage Room Templates</DialogTitle>
            <DialogDescription>
              Create reusable room templates that can be added to any inspection template
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto flex-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Create New Room Template</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor="room-name">Room Name</Label>
                    <Input
                      id="room-name"
                      placeholder="e.g., Living Room, Kitchen, Bedroom"
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          addRoom();
                        }
                      }}
                    />
                  </div>
                  <Button onClick={addRoom} className="mt-auto">
                    <Plus className="mr-2 h-4 w-4" />
                    Add
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Existing Room Templates ({rooms.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {rooms.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No room templates yet. Create your first one above.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {rooms.map((room) => (
                      <div
                        key={room.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <span className="font-medium">{room.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteRoomId(room.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteRoomId} onOpenChange={() => setDeleteRoomId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Room Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this room template? This will not affect rooms already added to templates.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={deleteRoom}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
