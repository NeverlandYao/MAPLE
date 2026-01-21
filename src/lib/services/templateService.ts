import { query } from '@/lib/db';

export interface VariableTemplate {
  id: string;
  name: string;
  description?: string;
  template_json: any;
  created_at: Date;
  updated_at: Date;
}

export const templateService = {
  async getAll(): Promise<VariableTemplate[]> {
    const res = await query<VariableTemplate>(
      'SELECT * FROM variable_templates ORDER BY created_at DESC'
    );
    return res.rows;
  },

  async getById(id: string): Promise<VariableTemplate | null> {
    const res = await query<VariableTemplate>(
      'SELECT * FROM variable_templates WHERE id = $1',
      [id]
    );
    return res.rows[0] || null;
  },

  async create(data: {
    name: string;
    description?: string;
    template_json: any;
  }): Promise<VariableTemplate> {
    const res = await query<VariableTemplate>(
      'INSERT INTO variable_templates (name, description, template_json) VALUES ($1, $2, $3) RETURNING *',
      [data.name, data.description, data.template_json]
    );
    return res.rows[0];
  },

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      template_json?: any;
    }
  ): Promise<VariableTemplate | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(data.description);
    }
    if (data.template_json !== undefined) {
      fields.push(`template_json = $${idx++}`);
      values.push(data.template_json);
    }

    if (fields.length === 0) return this.getById(id);

    values.push(id);
    const res = await query<VariableTemplate>(
      `UPDATE variable_templates SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return res.rows[0] || null;
  },

  async delete(id: string): Promise<boolean> {
    const res = await query('DELETE FROM variable_templates WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  },
};
