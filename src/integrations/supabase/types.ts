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
      audit_log: {
        Row: {
          accion: string
          created_at: string
          id: string
          payload: Json | null
          registro_id: string | null
          rol: string | null
          tabla: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          accion: string
          created_at?: string
          id?: string
          payload?: Json | null
          registro_id?: string | null
          rol?: string | null
          tabla: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          accion?: string
          created_at?: string
          id?: string
          payload?: Json | null
          registro_id?: string | null
          rol?: string | null
          tabla?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      boletas: {
        Row: {
          archivo_nombre: string | null
          archivo_path: string | null
          created_at: string
          descripcion: string | null
          fecha: string
          id: string
          monto: number
          responsable: string | null
          solicitud_id: string | null
          subido_por: string
          tipo_gasto: Database["public"]["Enums"]["expense_type"]
        }
        Insert: {
          archivo_nombre?: string | null
          archivo_path?: string | null
          created_at?: string
          descripcion?: string | null
          fecha?: string
          id?: string
          monto: number
          responsable?: string | null
          solicitud_id?: string | null
          subido_por: string
          tipo_gasto: Database["public"]["Enums"]["expense_type"]
        }
        Update: {
          archivo_nombre?: string | null
          archivo_path?: string | null
          created_at?: string
          descripcion?: string | null
          fecha?: string
          id?: string
          monto?: number
          responsable?: string | null
          solicitud_id?: string | null
          subido_por?: string
          tipo_gasto?: Database["public"]["Enums"]["expense_type"]
        }
        Relationships: [
          {
            foreignKeyName: "boletas_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes_egreso"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          correo: string
          created_at: string
          direccion: string
          id: string
          nombre: string
          telefono: string
        }
        Insert: {
          correo: string
          created_at?: string
          direccion: string
          id?: string
          nombre: string
          telefono: string
        }
        Update: {
          correo?: string
          created_at?: string
          direccion?: string
          id?: string
          nombre?: string
          telefono?: string
        }
        Relationships: []
      }
      colores: {
        Row: {
          activo: boolean
          created_at: string
          hex: string
          id: string
          imagen_url: string | null
          nombre: string
          orden: number
          stock_m: number
        }
        Insert: {
          activo?: boolean
          created_at?: string
          hex?: string
          id?: string
          imagen_url?: string | null
          nombre: string
          orden?: number
          stock_m?: number
        }
        Update: {
          activo?: boolean
          created_at?: string
          hex?: string
          id?: string
          imagen_url?: string | null
          nombre?: string
          orden?: number
          stock_m?: number
        }
        Relationships: []
      }
      config_audit_log: {
        Row: {
          accion: string
          cambio: string
          created_at: string
          entidad: string
          id: string
          user_email: string
          user_id: string | null
          valor_antes: string | null
          valor_despues: string | null
        }
        Insert: {
          accion: string
          cambio: string
          created_at?: string
          entidad: string
          id?: string
          user_email: string
          user_id?: string | null
          valor_antes?: string | null
          valor_despues?: string | null
        }
        Update: {
          accion?: string
          cambio?: string
          created_at?: string
          entidad?: string
          id?: string
          user_email?: string
          user_id?: string | null
          valor_antes?: string | null
          valor_despues?: string | null
        }
        Relationships: []
      }
      configuracion_web: {
        Row: {
          cotizador_titulo: string
          direccion: string
          form_fields: Json
          hero_h1_linea1: string
          hero_h1_linea2: string
          hero_h1_linea3: string
          hero_subtitulo: string
          hero_titulo: string
          hero_url: string | null
          id: number
          info_comercial: string
          instagram: string
          linktree_url: string
          logo_url: string | null
          mapa_embed: string
          mapa_url: string
          marca_texto: string
          precio_m2: number
          productos_titulo: string
          telefono: string
          updated_at: string
        }
        Insert: {
          cotizador_titulo?: string
          direccion?: string
          form_fields?: Json
          hero_h1_linea1?: string
          hero_h1_linea2?: string
          hero_h1_linea3?: string
          hero_subtitulo?: string
          hero_titulo?: string
          hero_url?: string | null
          id?: number
          info_comercial?: string
          instagram?: string
          linktree_url?: string
          logo_url?: string | null
          mapa_embed?: string
          mapa_url?: string
          marca_texto?: string
          precio_m2?: number
          productos_titulo?: string
          telefono?: string
          updated_at?: string
        }
        Update: {
          cotizador_titulo?: string
          direccion?: string
          form_fields?: Json
          hero_h1_linea1?: string
          hero_h1_linea2?: string
          hero_h1_linea3?: string
          hero_subtitulo?: string
          hero_titulo?: string
          hero_url?: string | null
          id?: number
          info_comercial?: string
          instagram?: string
          linktree_url?: string
          logo_url?: string | null
          mapa_embed?: string
          mapa_url?: string
          marca_texto?: string
          precio_m2?: number
          productos_titulo?: string
          telefono?: string
          updated_at?: string
        }
        Relationships: []
      }
      cotizacion_items: {
        Row: {
          ancho_m: number
          cantidad_planchas: number
          color_id: string | null
          color_nombre: string | null
          cotizacion_id: string
          created_at: string
          espesor_mm: number
          id: string
          largo_m: number
          metros2: number
          position: number
          tipo: Database["public"]["Enums"]["tipo_producto"]
          variante_id: string | null
        }
        Insert: {
          ancho_m?: number
          cantidad_planchas?: number
          color_id?: string | null
          color_nombre?: string | null
          cotizacion_id: string
          created_at?: string
          espesor_mm?: number
          id?: string
          largo_m: number
          metros2: number
          position?: number
          tipo?: Database["public"]["Enums"]["tipo_producto"]
          variante_id?: string | null
        }
        Update: {
          ancho_m?: number
          cantidad_planchas?: number
          color_id?: string | null
          color_nombre?: string | null
          cotizacion_id?: string
          created_at?: string
          espesor_mm?: number
          id?: string
          largo_m?: number
          metros2?: number
          position?: number
          tipo?: Database["public"]["Enums"]["tipo_producto"]
          variante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cotizacion_items_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "colores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_items_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "colores_publicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_items_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "cotizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      cotizaciones: {
        Row: {
          access_token: string
          ancho_m: number
          cantidad_planchas: number
          cliente_id: string
          color_id: string | null
          color_nombre: string | null
          created_at: string
          created_by: string | null
          descuento: number
          estado: Database["public"]["Enums"]["quote_status"]
          estado_pedido: Database["public"]["Enums"]["estado_pedido"]
          fecha_solicitud: string
          id: string
          largo_m: number
          metros2: number
          numero: string
          origen: string
          pago_recibido: number
          plazo_horas: number
          precio_m2: number
          responsable_nombre: string | null
          saldo: number
          stock_descontado_at: string | null
          total: number
          updated_at: string
        }
        Insert: {
          access_token: string
          ancho_m?: number
          cantidad_planchas?: number
          cliente_id: string
          color_id?: string | null
          color_nombre?: string | null
          created_at?: string
          created_by?: string | null
          descuento?: number
          estado?: Database["public"]["Enums"]["quote_status"]
          estado_pedido?: Database["public"]["Enums"]["estado_pedido"]
          fecha_solicitud?: string
          id?: string
          largo_m: number
          metros2: number
          numero: string
          origen?: string
          pago_recibido?: number
          plazo_horas?: number
          precio_m2: number
          responsable_nombre?: string | null
          saldo?: number
          stock_descontado_at?: string | null
          total: number
          updated_at?: string
        }
        Update: {
          access_token?: string
          ancho_m?: number
          cantidad_planchas?: number
          cliente_id?: string
          color_id?: string | null
          color_nombre?: string | null
          created_at?: string
          created_by?: string | null
          descuento?: number
          estado?: Database["public"]["Enums"]["quote_status"]
          estado_pedido?: Database["public"]["Enums"]["estado_pedido"]
          fecha_solicitud?: string
          id?: string
          largo_m?: number
          metros2?: number
          numero?: string
          origen?: string
          pago_recibido?: number
          plazo_horas?: number
          precio_m2?: number
          responsable_nombre?: string | null
          saldo?: number
          stock_descontado_at?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cotizaciones_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "colores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "colores_publicos"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos_historicos: {
        Row: {
          created_at: string
          created_by: string | null
          descripcion: string | null
          gastos: number
          id: string
          periodo: string
          updated_at: string
          ventas: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          gastos?: number
          id?: string
          periodo: string
          updated_at?: string
          ventas?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          gastos?: number
          id?: string
          periodo?: string
          updated_at?: string
          ventas?: number
        }
        Relationships: []
      }
      pagos: {
        Row: {
          cotizacion_id: string
          created_at: string
          estado: string
          id: string
          metodo: string
          monto: number
          porcentaje: number | null
        }
        Insert: {
          cotizacion_id: string
          created_at?: string
          estado?: string
          id?: string
          metodo?: string
          monto: number
          porcentaje?: number | null
        }
        Update: {
          cotizacion_id?: string
          created_at?: string
          estado?: string
          id?: string
          metodo?: string
          monto?: number
          porcentaje?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "cotizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      producto_variantes: {
        Row: {
          activo: boolean
          color_id: string
          created_at: string
          espesor_mm: number
          fabricado_m: number
          id: string
          tipo: Database["public"]["Enums"]["tipo_producto"]
          updated_at: string
        }
        Insert: {
          activo?: boolean
          color_id: string
          created_at?: string
          espesor_mm?: number
          fabricado_m?: number
          id?: string
          tipo: Database["public"]["Enums"]["tipo_producto"]
          updated_at?: string
        }
        Update: {
          activo?: boolean
          color_id?: string
          created_at?: string
          espesor_mm?: number
          fabricado_m?: number
          id?: string
          tipo?: Database["public"]["Enums"]["tipo_producto"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "producto_variantes_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "colores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_variantes_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "colores_publicos"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitudes_egreso: {
        Row: {
          boleta_subida_por: string | null
          created_at: string
          decidido_at: string | null
          decidido_por: string | null
          descripcion: string
          estado: Database["public"]["Enums"]["expense_status"]
          fecha: string
          id: string
          latas: Json
          monto: number
          solicitado_por: string
          solicitante_id: string
          tipo: Database["public"]["Enums"]["expense_type"]
        }
        Insert: {
          boleta_subida_por?: string | null
          created_at?: string
          decidido_at?: string | null
          decidido_por?: string | null
          descripcion: string
          estado?: Database["public"]["Enums"]["expense_status"]
          fecha?: string
          id?: string
          latas?: Json
          monto: number
          solicitado_por: string
          solicitante_id: string
          tipo: Database["public"]["Enums"]["expense_type"]
        }
        Update: {
          boleta_subida_por?: string | null
          created_at?: string
          decidido_at?: string | null
          decidido_por?: string | null
          descripcion?: string
          estado?: Database["public"]["Enums"]["expense_status"]
          fecha?: string
          id?: string
          latas?: Json
          monto?: number
          solicitado_por?: string
          solicitante_id?: string
          tipo?: Database["public"]["Enums"]["expense_type"]
        }
        Relationships: []
      }
      stock_movimientos: {
        Row: {
          color_id: string | null
          color_nombre: string | null
          cotizacion_id: string | null
          cotizacion_numero: string | null
          created_at: string
          espesor_mm: number | null
          id: string
          metros: number
          motivo: string
          tipo: Database["public"]["Enums"]["tipo_producto"] | null
          user_email: string | null
          user_id: string | null
          variante_id: string | null
        }
        Insert: {
          color_id?: string | null
          color_nombre?: string | null
          cotizacion_id?: string | null
          cotizacion_numero?: string | null
          created_at?: string
          espesor_mm?: number | null
          id?: string
          metros: number
          motivo: string
          tipo?: Database["public"]["Enums"]["tipo_producto"] | null
          user_email?: string | null
          user_id?: string | null
          variante_id?: string | null
        }
        Update: {
          color_id?: string | null
          color_nombre?: string | null
          cotizacion_id?: string | null
          cotizacion_numero?: string | null
          created_at?: string
          espesor_mm?: number | null
          id?: string
          metros?: number
          motivo?: string
          tipo?: Database["public"]["Enums"]["tipo_producto"] | null
          user_email?: string | null
          user_id?: string | null
          variante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movimientos_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "colores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movimientos_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "colores_publicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movimientos_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "cotizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movimientos_variante_id_fkey"
            columns: ["variante_id"]
            isOneToOne: false
            referencedRelation: "producto_variantes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      colores_publicos: {
        Row: {
          activo: boolean | null
          created_at: string | null
          hex: string | null
          id: string | null
          imagen_url: string | null
          nombre: string | null
          orden: number | null
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          hex?: string | null
          id?: string | null
          imagen_url?: string | null
          nombre?: string | null
          orden?: number | null
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          hex?: string | null
          id?: string | null
          imagen_url?: string | null
          nombre?: string | null
          orden?: number | null
        }
        Relationships: []
      }
      v_alertas: {
        Row: {
          mensaje: string | null
          meta: Json | null
          ocurrido_at: string | null
          registro_id: string | null
          severidad: string | null
          tipo: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      ensure_variant: {
        Args: { _color_id: string; _espesor_mm?: number; _tipo: string }
        Returns: string
      }
      fetch_or_create_variant: {
        Args: { _color_id: string; _espesor_mm?: number; _tipo: string }
        Returns: {
          activo: boolean
          color_id: string
          espesor_mm: number
          fabricado_m: number
          id: string
          stock_m: number
          tipo: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      nextval_quote: { Args: never; Returns: number }
    }
    Enums: {
      app_role: "admin" | "operator"
      estado_pedido:
        | "en_preparacion"
        | "en_produccion"
        | "pedido_entregado"
        | "finalizado"
      expense_status: "pendiente" | "aprobado" | "rechazado"
      expense_type:
        | "materiales"
        | "transporte"
        | "herramientas"
        | "servicios"
        | "otros"
      quote_status:
        | "cotizacion_creada"
        | "esperando_pago"
        | "pago_parcial"
        | "pedido_confirmado"
        | "pedido_terminado"
        | "rechazada"
      tipo_producto:
        | "Ondulado"
        | "PV8"
        | "PV8 Invertido"
        | "Microondulado"
        | "6V"
        | "PV4"
        | "Lata Lisa"
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
    Enums: {
      app_role: ["admin", "operator"],
      estado_pedido: [
        "en_preparacion",
        "en_produccion",
        "pedido_entregado",
        "finalizado",
      ],
      expense_status: ["pendiente", "aprobado", "rechazado"],
      expense_type: [
        "materiales",
        "transporte",
        "herramientas",
        "servicios",
        "otros",
      ],
      quote_status: [
        "cotizacion_creada",
        "esperando_pago",
        "pago_parcial",
        "pedido_confirmado",
        "pedido_terminado",
        "rechazada",
      ],
      tipo_producto: [
        "Ondulado",
        "PV8",
        "PV8 Invertido",
        "Microondulado",
        "6V",
        "PV4",
        "Lata Lisa",
      ],
    },
  },
} as const
