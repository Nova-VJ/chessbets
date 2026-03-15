export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_invites: {
        Row: {
          created_at: string
          currency: string
          from_user_id: string
          game_id: string | null
          id: string
          stake_amount: number
          status: string
          time_control: number
          to_user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          from_user_id: string
          game_id?: string | null
          id?: string
          stake_amount?: number
          status?: string
          time_control?: number
          to_user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          from_user_id?: string
          game_id?: string | null
          id?: string
          stake_amount?: number
          status?: string
          time_control?: number
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_invites_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_invites_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_invites_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          contract_game_id: string | null
          created_at: string
          creator_id: string
          creator_paid: boolean
          ended_at: string | null
          id: string
          is_smart_contract: boolean
          opponent_id: string | null
          opponent_paid: boolean
          stake_amount: number
          started_at: string | null
          status: string
          time_control: number
          winner_id: string | null
        }
        Insert: {
          contract_game_id?: string | null
          created_at?: string
          creator_id: string
          creator_paid?: boolean
          ended_at?: string | null
          id?: string
          is_smart_contract?: boolean
          opponent_id?: string | null
          opponent_paid?: boolean
          stake_amount: number
          started_at?: string | null
          status?: string
          time_control?: number
          winner_id?: string | null
        }
        Update: {
          contract_game_id?: string | null
          created_at?: string
          creator_id?: string
          creator_paid?: boolean
          ended_at?: string | null
          id?: string
          is_smart_contract?: boolean
          opponent_id?: string | null
          opponent_paid?: boolean
          stake_amount?: number
          started_at?: string | null
          status?: string
          time_control?: number
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_opponent_id_fkey"
            columns: ["opponent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matchmaking_queue: {
        Row: {
          currency: string
          game_id: string | null
          id: string
          joined_at: string
          matched_at: string | null
          rating: number
          stake_amount: number
          status: string
          time_control: number
          user_id: string
        }
        Insert: {
          currency?: string
          game_id?: string | null
          id?: string
          joined_at?: string
          matched_at?: string | null
          rating?: number
          stake_amount: number
          status?: string
          time_control?: number
          user_id: string
        }
        Update: {
          currency?: string
          game_id?: string | null
          id?: string
          joined_at?: string
          matched_at?: string | null
          rating?: number
          stake_amount?: number
          status?: string
          time_control?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matchmaking_queue_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchmaking_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          balance: number
          created_at: string
          display_name: string | null
          email: string | null
          games_played: number
          games_won: number
          id: string
          preferred_wallet: string | null
          rating: number
          total_deposited: number
          total_withdrawn: number
          total_won: number
          total_won_usdt: number
          updated_at: string
          wallet_address: string | null
        }
        Insert: {
          balance?: number
          created_at?: string
          display_name?: string | null
          email?: string | null
          games_played?: number
          games_won?: number
          id: string
          preferred_wallet?: string | null
          rating?: number
          total_deposited?: number
          total_withdrawn?: number
          total_won?: number
          total_won_usdt?: number
          updated_at?: string
          wallet_address?: string | null
        }
        Update: {
          balance?: number
          created_at?: string
          display_name?: string | null
          email?: string | null
          games_played?: number
          games_won?: number
          id?: string
          preferred_wallet?: string | null
          rating?: number
          total_deposited?: number
          total_withdrawn?: number
          total_won?: number
          total_won_usdt?: number
          updated_at?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          status: string
          tx_hash: string | null
          type: string
          user_id: string
          wallet_address: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          status?: string
          tx_hash?: string | null
          type: string
          user_id: string
          wallet_address?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          status?: string
          tx_hash?: string | null
          type?: string
          user_id?: string
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
