import { InferSelectModel, relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const accountsTable = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    type: text("type").default("oauth").notNull(),
    provider: text("provider").default("google").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
  },
  (account) => ({
    pk: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const usersTable = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull(),
  image: text("image"),
});

export const usersRelations = relations(usersTable, ({ many }) => ({
  boards: many(boardsTable),
}));

export const boardsTable = pgTable("boards", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: text("created_by")
    .notNull()
    .references(() => usersTable.id),
  public: boolean("public").notNull().default(false),
});

export const boardsRelations = relations(boardsTable, ({ many }) => ({
  users: many(usersTable),
}));

export const boardsToUsers = pgTable(
  "boards_to_users",
  {
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id),
    boardId: text("board_id")
      .notNull()
      .references(() => boardsTable.id),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.boardId] }),
  })
);

export const boardsToUsersRelations = relations(boardsToUsers, ({ one }) => ({
  group: one(boardsTable, {
    fields: [boardsToUsers.boardId],
    references: [boardsTable.id],
  }),
  user: one(usersTable, {
    fields: [boardsToUsers.userId],
    references: [usersTable.id],
  }),
  // TODO: probably add member or admin here
}));

export const listsTable = pgTable("list", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 128 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: text("created_by")
    .notNull()
    .references(() => usersTable.id),
  boardId: text("board_id")
    .notNull()
    .references(() => boardsTable.id),
  position: integer("position").notNull(),
});

export const cardsTable = pgTable(
  "card",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: varchar("name", { length: 128 }).notNull(),
    description: text("description"),
    position: integer("position").notNull(),
    listId: text("list_id")
      .notNull()
      .references(() => listsTable.id),
  },
  (t) => {
    return { listAndPosIndex: index("list_and_pos").on(t.listId, t.position) };
  }
);

export const activitiesTable = pgTable("activities", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  description: text("description").notNull(),
  userName: text("user_name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id),
  cardId: text("card_id")
    .notNull()
    .references(() => cardsTable.id),
});

export const attachmentsTable = pgTable("attachments", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  url: text("url").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  cardId: text("card_id")
    .notNull()
    .references(() => cardsTable.id),
});

export type User = InferSelectModel<typeof usersTable>;
export type Board = InferSelectModel<typeof boardsTable>;
export type List = InferSelectModel<typeof listsTable>;
export type Card = InferSelectModel<typeof cardsTable>;
export type Acitivity = InferSelectModel<typeof activitiesTable>;
export type Attachment = InferSelectModel<typeof attachmentsTable>;

export interface ListWithDateAsString extends Omit<List, "createdAt"> {
  createdAt: string;
}
export interface BoardWithDateAsString extends Omit<Board, "createdAt"> {
  createdAt: string;
}
export interface BoardWithDateAsStringAndUser
  extends Omit<BoardWithDateAsString, "createdBy"> {
  user: User | null;
}
export interface CardWithDateAsString extends Omit<Card, "createdAt"> {
  createdAt: string;
}
export interface ActivityWithDateAsString extends Omit<Acitivity, "createdAt"> {
  createdAt: string;
}
export interface AttachmentWithDateAsString
  extends Omit<Attachment, "createdAt"> {
  createdAt: string;
}
export interface ActivityWIthDateAsStringAndUser
  extends ActivityWithDateAsString {
  user: User;
}
export interface CardWithDateAsStringAndActivities
  extends CardWithDateAsString {
  activities: ActivityWIthDateAsStringAndUser[];
}
export interface CardWithDateAsStringAndAttachments
  extends CardWithDateAsString {
  attachment: AttachmentWithDateAsString[];
}
export interface ListWithDateAsStringAndCards {
  id: string;
  list: ListWithDateAsString;
  cards: CardWithDateAsString[];
}
