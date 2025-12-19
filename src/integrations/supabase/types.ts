export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      clientes: {
        Row: {
          atualizado_em: string
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          complemento: string | null
          cpf: string | null
          criado_em: string
          email: string | null
          endereco: string | null
          estado: string | null
          formulario_enviado: boolean | null
          id: string
          link_formulario: string | null
          nome: string
          numero: string | null
          telefone: string | null
        }
        Insert: {
          atualizado_em?: string
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          cpf?: string | null
          criado_em?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          formulario_enviado?: boolean | null
          id?: string
          link_formulario?: string | null
          nome: string
          numero?: string | null
          telefone?: string | null
        }
        Update: {
          atualizado_em?: string
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          cpf?: string | null
          criado_em?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          formulario_enviado?: boolean | null
          id?: string
          link_formulario?: string | null
          nome?: string
          numero?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
      empresas: {
        Row: {
          id: number
          created_at: string
          nome: string | null
          cnpj: string | null
          cor: string | null
          logo: string | null
        }
        Insert: {
          id?: number
          created_at?: string
          nome?: string | null
          cnpj?: string | null
          cor?: string | null
          logo?: string | null
        }
        Update: {
          id?: number
          created_at?: string
          nome?: string | null
          cnpj?: string | null
          cor?: string | null
          logo?: string | null
        }
        Relationships: []
      }
      itens_pedido: {
        Row: {
          atualizado_em: string
          criado_em: string
          id: string
          pedido_id: string | null
          preco_unitario: number
          produto_id: string | null
          quantidade: number
          variacao_id: string | null
          status_up_sell: number | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          pedido_id?: string | null
          preco_unitario: number
          produto_id?: string | null
          quantidade?: number
          variacao_id?: string | null
          status_up_sell?: number | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          pedido_id?: string | null
          preco_unitario?: number
          produto_id?: string | null
          quantidade?: number
          variacao_id?: string | null
          status_up_sell?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "itens_pedido_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_pedido_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_pedido_variacao_id_fkey"
            columns: ["variacao_id"]
            isOneToOne: false
            referencedRelation: "variacoes_produto"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          atualizado_em: string
          cliente_id: string | null
          cliente_nome: string
          contato: string | null
          criado_em: string
          data_prevista: string | null
          etiqueta_envio_id: string | null
          frete_melhor_envio: Json | null
          id: string
          id_externo: string
          observacoes: string | null
          plataforma_id: string | null
          responsavel_id: string | null
          status_id: string | null
          urgente: boolean
          tempo_ganho: string | null
          etiqueta_ml: boolean | null
          pedido_liberado: boolean | null
        }
        Insert: {
          atualizado_em?: string
          cliente_id?: string | null
          cliente_nome: string
          contato?: string | null
          criado_em?: string
          data_prevista?: string | null
          etiqueta_envio_id?: string | null
          id?: string
          id_externo: string
          observacoes?: string | null
          plataforma_id?: string | null
          responsavel_id?: string | null
          status_id?: string | null
          urgente?: boolean
          tempo_ganho?: string | null
          etiqueta_ml?: boolean | null
          pedido_liberado?: boolean | null
        }
        Update: {
          atualizado_em?: string
          cliente_id?: string | null
          cliente_nome?: string
          contato?: string | null
          criado_em?: string
          data_prevista?: string | null
          etiqueta_envio_id?: string | null
          id?: string
          id_externo?: string
          observacoes?: string | null
          plataforma_id?: string | null
          responsavel_id?: string | null
          status_id?: string | null
          urgente?: boolean
          tempo_ganho?: string | null
          etiqueta_ml?: boolean | null
          pedido_liberado?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_etiqueta_envio_id_fkey"
            columns: ["etiqueta_envio_id"]
            isOneToOne: false
            referencedRelation: "tipos_etiqueta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_plataforma_id_fkey"
            columns: ["plataforma_id"]
            isOneToOne: false
            referencedRelation: "plataformas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "status"
            referencedColumns: ["id"]
          },
        ]
      }
      plataformas: {
        Row: {
          atualizado_em: string
          cor: string
          criado_em: string
          id: string
          img_url: string | null
          nome: string
        }
        Insert: {
          atualizado_em?: string
          cor: string
          criado_em?: string
          id?: string
          img_url?: string | null
          nome: string
        }
        Update: {
          atualizado_em?: string
          cor?: string
          criado_em?: string
          id?: string
          img_url?: string | null
          nome?: string
        }
        Relationships: []
      }
      produtos: {
        Row: {
          atualizado_em: string
          categoria: string | null
          criado_em: string
          embalgens_id: string | null
          nome_variacao: string | null
          id: string
          img_url: string | null
          nome: string
          preco: number
          qntd: number | null
          sku: string
          unidade: string
          up_cell: boolean | null
          lista_id_upsell: string[] | null
          contagem: number | null
        }
        Insert: {
          atualizado_em?: string
          categoria?: string | null
          criado_em?: string
          embalgens_id?: string | null
          nome_variacao?: string | null
          id?: string
          img_url?: string | null
          nome: string
          preco: number
          qntd?: number | null
          sku: string
          unidade?: string
          up_cell?: boolean | null
          lista_id_upsell?: string[] | null
          contagem?: number | null
        }
        Update: {
          atualizado_em?: string
          categoria?: string | null
          criado_em?: string
          embalgens_id?: string | null
          nome_variacao?: string | null
          id?: string
          img_url?: string | null
          nome?: string
          preco?: number
          qntd?: number | null
          sku?: string
          unidade?: string
          up_cell?: boolean | null
          lista_id_upsell?: string[] | null
          contagem?: number | null
        }
        Relationships: []
      }
      status: {
        Row: {
          atualizado_em: string
          cor_hex: string
          criado_em: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          atualizado_em?: string
          cor_hex: string
          criado_em?: string
          id?: string
          nome: string
          ordem: number
        }
        Update: {
          atualizado_em?: string
          cor_hex?: string
          criado_em?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      status_upsell: {
        Row: {
          id: number
          status: string
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: number
          status: string
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          id?: number
          status?: string
          criado_em?: string
          atualizado_em?: string
        }
        Relationships: []
      }
      metricas_upsell: {
        Row: {
          id: string
          pedido_id: string
          responsavel_id: string
          status_upsell: number
          criado_em: string
        }
        Insert: {
          id?: string
          pedido_id: string
          responsavel_id: string
          status_upsell: number
          criado_em?: string
        }
        Update: {
          id?: string
          pedido_id?: string
          responsavel_id?: string
          status_upsell?: number
          criado_em?: string
        }
        Relationships: []
      }
      tipos_etiqueta: {
        Row: {
          atualizado_em: string
          cor_hex: string
          criado_em: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          atualizado_em?: string
          cor_hex: string
          criado_em?: string
          id?: string
          nome: string
          ordem: number
        }
        Update: {
          atualizado_em?: string
          cor_hex?: string
          criado_em?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          acesso: string
          ativo: boolean
          atualizado_em: string
          criado_em: string
          email: string
          id: string
          img_url: string | null
          nome: string
        }
        Insert: {
          acesso: string
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          email: string
          id?: string
          img_url?: string | null
          nome: string
        }
        Update: {
          acesso?: string
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          email?: string
          id?: string
          img_url?: string | null
          nome?: string
        }
        Relationships: []
      }
      variacoes_produto: {
        Row: {
          atualizado_em: string
          criado_em: string
          id: string
          img_url: string | null
          nome: string
          produto_id: string | null
          qntd: number | null
          sku: string
          valor: number
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          img_url?: string | null
          nome: string
          produto_id?: string | null
          qntd?: number | null
          sku: string
          valor: number
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          img_url?: string | null
          nome?: string
          produto_id?: string | null
          qntd?: number | null
          sku?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "variacoes_produto_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          }
        ]
      },
      embalagens: {
        Row: {
          id: string
          nome: string
          altura: number
          largura: number
          comprimento: number
          peso: number
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: string
          nome: string
          altura: number
          largura: number
          comprimento: number
          peso: number
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          id?: string
          nome?: string
          altura?: number
          largura?: number
          comprimento?: number
          peso?: number
          criado_em?: string
          atualizado_em?: string
        }
        Relationships: []
      },
      remetentes: {
        Row: {
          id: string
          nome: string
          cep: string
          endereco: string
          cidade: string
          estado: string
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: string
          nome: string
          cep: string
          endereco: string
          cidade: string
          estado: string
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          id?: string
          nome?: string
          cep?: string
          endereco?: string
          cidade?: string
          estado?: string
          criado_em?: string
          atualizado_em?: string
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
