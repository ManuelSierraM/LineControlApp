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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alertas: {
        Row: {
          created_at: string
          detalle: string | null
          entidad: string | null
          id: string
          mensaje: string
          referencia: string | null
          resuelta: boolean
          severidad: string
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          detalle?: string | null
          entidad?: string | null
          id?: string
          mensaje: string
          referencia?: string | null
          resuelta?: boolean
          severidad?: string
          tipo: string
          user_id: string
        }
        Update: {
          created_at?: string
          detalle?: string | null
          entidad?: string | null
          id?: string
          mensaje?: string
          referencia?: string | null
          resuelta?: boolean
          severidad?: string
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      archivos_carga: {
        Row: {
          created_at: string
          estado: string
          id: string
          nombre: string
          registros: number
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          estado?: string
          id?: string
          nombre: string
          registros?: number
          tipo: string
          user_id: string
        }
        Update: {
          created_at?: string
          estado?: string
          id?: string
          nombre?: string
          registros?: number
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      centros_costo: {
        Row: {
          codigo: string
          created_at: string
          id: string
          nombre: string
          user_id: string
        }
        Insert: {
          codigo: string
          created_at?: string
          id?: string
          nombre: string
          user_id: string
        }
        Update: {
          codigo?: string
          created_at?: string
          id?: string
          nombre?: string
          user_id?: string
        }
        Relationships: []
      }
      dispositivos: {
        Row: {
          asignado_a: string | null
          created_at: string
          estado: string | null
          fabricante: string | null
          id: string
          imei: string
          modelo: string | null
          numero_telefono: string | null
          so: string | null
          ultimo_checkin: string | null
          user_id: string
        }
        Insert: {
          asignado_a?: string | null
          created_at?: string
          estado?: string | null
          fabricante?: string | null
          id?: string
          imei: string
          modelo?: string | null
          numero_telefono?: string | null
          so?: string | null
          ultimo_checkin?: string | null
          user_id: string
        }
        Update: {
          asignado_a?: string | null
          created_at?: string
          estado?: string | null
          fabricante?: string | null
          id?: string
          imei?: string
          modelo?: string | null
          numero_telefono?: string | null
          so?: string | null
          ultimo_checkin?: string | null
          user_id?: string
        }
        Relationships: []
      }
      lineas: {
        Row: {
          centro_costo: string | null
          consumo_mb: number | null
          costo_mensual: number | null
          created_at: string
          estado: string | null
          iccid: string | null
          id: string
          imei: string | null
          msisdn: string
          plan: string | null
          ultimo_uso: string | null
          user_id: string
          valor_datos: number | null
          valor_plan: number | null
        }
        Insert: {
          centro_costo?: string | null
          consumo_mb?: number | null
          costo_mensual?: number | null
          created_at?: string
          estado?: string | null
          iccid?: string | null
          id?: string
          imei?: string | null
          msisdn: string
          plan?: string | null
          ultimo_uso?: string | null
          user_id: string
          valor_datos?: number | null
          valor_plan?: number | null
        }
        Update: {
          centro_costo?: string | null
          consumo_mb?: number | null
          costo_mensual?: number | null
          created_at?: string
          estado?: string | null
          iccid?: string | null
          id?: string
          imei?: string | null
          msisdn?: string
          plan?: string | null
          ultimo_uso?: string | null
          user_id?: string
          valor_datos?: number | null
          valor_plan?: number | null
        }
        Relationships: []
      }
      pops: {
        Row: {
          centro_costo: string | null
          codigo: string
          created_at: string
          estado: string | null
          id: string
          numero_telefono: string | null
          responsable: string | null
          ubicacion: string | null
          user_id: string
        }
        Insert: {
          centro_costo?: string | null
          codigo: string
          created_at?: string
          estado?: string | null
          id?: string
          numero_telefono?: string | null
          responsable?: string | null
          ubicacion?: string | null
          user_id: string
        }
        Update: {
          centro_costo?: string | null
          codigo?: string
          created_at?: string
          estado?: string | null
          id?: string
          numero_telefono?: string | null
          responsable?: string | null
          ubicacion?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
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
