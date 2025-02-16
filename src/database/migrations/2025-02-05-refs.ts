import { Migration, sql } from "kysely";

export const Migration20250205Refs: Migration = {
  async up(db) {
    const yearSchema = db.schema
      .createTable("snbt_year")
      .ifNotExists()
      .addColumn("id", "integer", (col) => col.notNull().primaryKey().autoIncrement())
      .addColumn("year", "integer", (col) => col.notNull())
      .addColumn("dumped_at", "timestamp", (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`));

    const dataSchema = db.schema
      .createTable("snbt_data")
      .ifNotExists()
      .addColumn("id", "integer", (col) => col.notNull().primaryKey().autoIncrement())
      .addColumn('snbt_year', 'integer', (col) => col.notNull())
      .addColumn("snbt_year_ref", "integer", (col) => col.notNull().references('snbt_year.id'))
      .addColumn("utbk_number", sql`TEXT COLLATE NOCASE NOT NULL`)
      .addColumn("name", "text", (col) => col.notNull())
      .addColumn("date_of_birth", "text", (col) => col.notNull())
      .addColumn("is_scholarship", "boolean", (col) => col.notNull())
      .addColumn("accepted", "boolean", (col) => col.notNull())
      .addColumn("university_code", "integer")
      .addColumn("university_name", "text")
      .addColumn("university_url", "text")
      .addColumn("study_code", "integer")
      .addColumn("study_name", "text");

    await yearSchema.execute();
    await dataSchema.execute();

    await db.schema
      .createIndex("snbt_data_name_birth_idx")
      .ifNotExists()
      .on("snbt_data")
      .expression(sql`name COLLATE NOCASE`)
      .columns(["date_of_birth", "snbt_year"])
      .execute();

    await db.schema
      .createIndex("snbt_data_utbk_number_idx")
      .ifNotExists()
      .on("snbt_data")
      .columns(["utbk_number", "snbt_year"])
      .execute();
  },
  async down(db) {
    await db.schema.dropTable("snbt_year").ifExists().execute();
    await db.schema.dropTable("snbt_data").ifExists().execute();
  },
};
