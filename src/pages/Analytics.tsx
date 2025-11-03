import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, TrendingUp, CheckCircle2, XCircle, Calendar, Package } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { User as SupabaseUser } from "@supabase/supabase-js";

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'];

export default function Analytics() {
  const navigate = useNavigate();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{
    totalInspections: number;
    passRate: number;
    failRate: number;
    completedTasks: number;
    pendingTasks: number;
    topFailedItems: Array<{ name: string; count: number }>;
    inspectionsByType: Array<{ type: string; count: number }>;
    upcomingInspections: Array<{ date: string; count: number }>;
    monthlyTrend: Array<{ month: string; completed: number; pending: number }>;
  }>({
    totalInspections: 0,
    passRate: 0,
    failRate: 0,
    completedTasks: 0,
    pendingTasks: 0,
    topFailedItems: [],
    inspectionsByType: [],
    upcomingInspections: [],
    monthlyTrend: [],
  });

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      fetchAnalytics();
    }
  }, [user]);

  const fetchAnalytics = async () => {
    setLoading(true);

    try {
      // Fetch all inspections (including archived, but not deleted ones)
      const { data: inspections, error: inspError } = await supabase
        .from("inspections")
        .select("id, type, date, completed")
        .order("date", { ascending: false });

      if (inspError) throw inspError;

      // Fetch all subtasks with inventory info
      const { data: subtasks, error: subtasksError } = await supabase
        .from("subtasks")
        .select(`
          id,
          status,
          completed,
          inventory_type_id,
          inventory_quantity,
          inspection_id
        `);

      if (subtasksError) throw subtasksError;

      // Fetch inventory types
      const { data: inventoryTypes, error: invError } = await supabase
        .from("inventory_types")
        .select("id, name");

      if (invError) throw invError;

      // Calculate statistics
      const totalInspections = inspections?.length || 0;
      const completedInspections = inspections?.filter(i => i.completed).length || 0;

      // Task statistics
      const passedTasks = subtasks?.filter(s => s.status === 'pass' || s.completed).length || 0;
      const failedTasks = subtasks?.filter(s => s.status === 'fail').length || 0;
      const totalTasks = subtasks?.length || 0;
      
      const passRate = totalTasks > 0 ? (passedTasks / totalTasks) * 100 : 0;
      const failRate = totalTasks > 0 ? (failedTasks / totalTasks) * 100 : 0;

      // Top failed items
      const failedSubtasks = subtasks?.filter(s => s.status === 'fail' && s.inventory_type_id) || [];
      const itemCounts: Record<string, number> = {};
      failedSubtasks.forEach(task => {
        if (task.inventory_type_id) {
          itemCounts[task.inventory_type_id] = (itemCounts[task.inventory_type_id] || 0) + (task.inventory_quantity || 1);
        }
      });
      
      const topFailedItems = Object.entries(itemCounts)
        .map(([typeId, count]) => {
          const type = inventoryTypes?.find(t => t.id === typeId);
          return { name: type?.name || 'Unknown', count };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Inspections by type
      const typeCounts: Record<string, number> = {};
      inspections?.forEach(insp => {
        typeCounts[insp.type] = (typeCounts[insp.type] || 0) + 1;
      });
      const inspectionsByType = Object.entries(typeCounts).map(([type, count]) => ({ type, count }));

      // Upcoming inspections (next 30 days)
      const today = new Date();
      const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      const upcoming = inspections?.filter(i => {
        const inspDate = new Date(i.date);
        return inspDate >= today && inspDate <= thirtyDaysFromNow && !i.completed;
      }) || [];

      // Group upcoming by week
      const upcomingByWeek: Record<string, number> = {};
      upcoming.forEach(insp => {
        const date = new Date(insp.date);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];
        upcomingByWeek[weekKey] = (upcomingByWeek[weekKey] || 0) + 1;
      });
      const upcomingInspections = Object.entries(upcomingByWeek)
        .map(([date, count]) => ({ date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), count }))
        .slice(0, 4);

      // Monthly trend (last 6 months)
      const monthlyData: Record<string, { completed: number; pending: number }> = {};
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      inspections?.forEach(insp => {
        const inspDate = new Date(insp.date);
        if (inspDate >= sixMonthsAgo) {
          const monthKey = inspDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { completed: 0, pending: 0 };
          }
          if (insp.completed) {
            monthlyData[monthKey].completed++;
          } else {
            monthlyData[monthKey].pending++;
          }
        }
      });

      const monthlyTrend = Object.entries(monthlyData).map(([month, data]) => ({
        month,
        ...data,
      }));

      setStats({
        totalInspections,
        passRate,
        failRate,
        completedTasks: passedTasks,
        pendingTasks: totalTasks - passedTasks,
        topFailedItems,
        inspectionsByType,
        upcomingInspections,
        monthlyTrend,
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 sm:py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary rounded-lg">
              <BarChart3 className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Analytics</h1>
              <p className="text-sm text-muted-foreground">
                Inspection performance and trends
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Overview Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Inspections</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalInspections}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.passRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">{stats.completedTasks} tasks passed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Fail Rate</CardTitle>
                <XCircle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{stats.failRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">{stats.pendingTasks} tasks need attention</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed Tasks</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.completedTasks}</div>
                <p className="text-xs text-muted-foreground">out of {stats.completedTasks + stats.pendingTasks} total</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 1 */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Pass/Fail Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Task Status Distribution</CardTitle>
                <CardDescription>Pass vs Fail breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Passed', value: stats.completedTasks },
                        { name: 'Failed/Pending', value: stats.pendingTasks },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top Failed Items */}
            <Card>
              <CardHeader>
                <CardTitle>Top Failed Items</CardTitle>
                <CardDescription>Most common inventory issues</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.topFailedItems}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 2 */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Inspections by Type */}
            <Card>
              <CardHeader>
                <CardTitle>Inspections by Type</CardTitle>
                <CardDescription>Distribution across inspection categories</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={stats.inspectionsByType}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ type, percent }) => `${type}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {stats.inspectionsByType.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Upcoming Inspections */}
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Inspections</CardTitle>
                <CardDescription>Next 30 days by week</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.upcomingInspections}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Inspection Trend</CardTitle>
              <CardDescription>Last 6 months completion status</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={stats.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} name="Completed" />
                  <Line type="monotone" dataKey="pending" stroke="#f59e0b" strokeWidth={2} name="Pending" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
