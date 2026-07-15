import type { Database } from '../../lib/database.types'

export type Goal = Database['public']['Tables']['goals']['Row']
export type GoalContribution = Database['public']['Tables']['goal_contributions']['Row']
