'use client'

import { useEffect, useState } from 'react'
import {
  Users,
  MessageSquare,
  TrendingUp,
  Calendar,
  Bot,
  Activity,
} from 'lucide-react'
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { timeAgo } from '@/shared/utils/date'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/i18n/context'

interface KpiData {
  total_prospects: number
  messages_sent: number
  reply_rate: number
  meetings_booked: number
}

interface ChartPoint {
  date: string
  count: number
}

interface TemperaturePoint {
  name: string
  value: number
  color: string
}

interface AgentRun {
  id: string
  intent_type: string
  status: string
  started_at: string
  error: string | null
}

const TEMP_CHART_COLORS = {
  cold: '#93c5fd',
  warm: '#fb923c',
  hot: '#ef4444',
}

export default function DashboardPage() {
  const t = useT()
  const [kpi, setKpi] = useState<KpiData | null>(null)
  const [chartData, setChartData] = useState<ChartPoint[]>([])
  const [tempData, setTempData] = useState<TemperaturePoint[]>([])
  const [recentRuns, setRecentRuns] = useState<AgentRun[]>([])
  const [agentRunning, setAgentRunning] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()

    const supabase = createClient()
    const channel = supabase
      .channel('agent-runs-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agent_runs' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const run = payload.new as AgentRun
            setRecentRuns((prev) => [run, ...prev].slice(0, 20))
            if (run.status === 'running') setAgentRunning(true)
          }
          if (payload.eventType === 'UPDATE') {
            const run = payload.new as AgentRun
            setRecentRuns((prev) => prev.map((r) => (r.id === run.id ? run : r)))
            fetchAgentStatus()
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchDashboardData(): Promise<void> {
    setLoading(true)
    try {
      const [kpiRes, chartRes, runsRes] = await Promise.all([
        fetch('/api/dashboard/kpi'),
        fetch('/api/dashboard/chart'),
        fetch('/api/agent/status'),
      ])
      const [kpiData, chartRawData, runsData] = await Promise.all([
        kpiRes.json(),
        chartRes.json(),
        runsRes.json(),
      ])

      setKpi(kpiData)

      if (chartRawData.timeline) setChartData(chartRawData.timeline)
      if (chartRawData.temperatures) {
        setTempData([
          { name: t('dashboard.cold'), value: chartRawData.temperatures.cold ?? 0, color: TEMP_CHART_COLORS.cold },
          { name: t('dashboard.warm'), value: chartRawData.temperatures.warm ?? 0, color: TEMP_CHART_COLORS.warm },
          { name: t('dashboard.hot'), value: chartRawData.temperatures.hot ?? 0, color: TEMP_CHART_COLORS.hot },
        ])
      }

      if (runsData.recentRuns) setRecentRuns(runsData.recentRuns)
      setAgentRunning(runsData.isRunning ?? false)
    } catch {
      // fallback
    } finally {
      setLoading(false)
    }
  }

  async function fetchAgentStatus(): Promise<void> {
    try {
      const res = await fetch('/api/agent/status')
      const data = await res.json()
      setAgentRunning(data.isRunning ?? false)
    } catch {
      // ignore
    }
  }

  const KPI_CARDS = [
    { label: t('dashboard.totalProspects'), value: kpi?.total_prospects ?? 0, icon: Users, color: 'text-blue-500' },
    { label: t('dashboard.messagesSent'), value: kpi?.messages_sent ?? 0, icon: MessageSquare, color: 'text-purple-500' },
    { label: t('dashboard.replyRate'), value: kpi ? `${kpi.reply_rate}%` : '0%', icon: TrendingUp, color: 'text-green-500' },
    { label: t('dashboard.meetingsBooked'), value: kpi?.meetings_booked ?? 0, icon: Calendar, color: 'text-orange-500' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('dashboard.title')}</h1>
          <p className="text-slate-500 text-sm mt-1">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className={`h-2 w-2 rounded-full ${agentRunning ? 'bg-green-400 animate-pulse' : 'bg-slate-300'}`} />
          <span className="text-slate-500">
            {agentRunning ? t('dashboard.agentRunning') : t('dashboard.agentIdle')}
          </span>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        {KPI_CARDS.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-6">
              {loading ? (
                <Skeleton className="h-12 w-full" />
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
                    <p className="text-3xl font-bold mt-1">{value}</p>
                  </div>
                  <Icon className={`h-8 w-8 ${color} opacity-80`} />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-6">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">{t('dashboard.prospectsChart')}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('dashboard.leadTemperature')}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : tempData.every((d) => d.value === 0) ? (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
                {t('dashboard.noDataYet')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={tempData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {tempData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend iconType="circle" iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity feed */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" />
            {t('dashboard.recentActivity')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : recentRuns.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Bot className="h-6 w-6 mx-auto mb-2 opacity-40" />
              <p className="text-sm">{t('dashboard.noActivity')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentRuns.map((run) => (
                <div key={run.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <Bot className="h-4 w-4 text-slate-400 shrink-0" />
                    <div>
                      <span className="font-medium">
                        {run.intent_type.replace(/_/g, ' ').toLowerCase()}
                      </span>
                      {run.error && <span className="text-red-500 ml-2 text-xs">{run.error}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="secondary"
                      className={
                        run.status === 'success' ? 'bg-green-100 text-green-700'
                        : run.status === 'failed' ? 'bg-red-100 text-red-700'
                        : run.status === 'running' ? 'bg-blue-100 text-blue-700'
                        : 'bg-slate-100 text-slate-600'
                      }
                    >
                      {run.status}
                    </Badge>
                    <span className="text-slate-400 text-xs">{timeAgo(run.started_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
