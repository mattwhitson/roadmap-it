import { db } from "db";
import { accountsTable, User, usersTable } from "db/schema";
import { and, eq } from "drizzle-orm";
import { Authenticator } from "remix-auth";
import { GoogleStrategy } from "remix-auth-google";
import { authSessionStorage } from "~/sessions.server";

const googleStrategy = new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: `${process.env.HOST_URL!}/action/auth/callback`,
  },
  async ({ /*accessToken, refreshToken, extraParams,*/ profile }) => {
    // Get the user data from your DB or API using the tokens and profile
    //return User.findOrCreate({ email: profile.emails[0].value })
    let acc = await db
      .select()
      .from(accountsTable)
      .where(
        and(
          eq(accountsTable.providerAccountId, profile.id),
          eq(accountsTable.provider, profile.provider)
        )
      );

    if (!acc[0]) {
      let newUser;

      try {
        newUser = await db
          .insert(usersTable)
          .values({
            email: profile._json.email,
            image: profile._json.picture,
            name: profile._json.name,
          })
          .returning();
        acc = await db
          .insert(accountsTable)
          .values({
            providerAccountId: profile.id,
            provider: "google",
            userId: newUser[0].id,
            type: "oauth",
          })
          .returning();
      } catch (error) {
        console.log(error);
        return {} as User;
      }

      return newUser[0];
    }

    const user = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, acc[0].userId));
    return user[0];
  }
);

// Create an instance of the authenticator, pass a generic with what
// strategies will return and will store in the session
export const authenticator = new Authenticator<User>(authSessionStorage);

authenticator.use(googleStrategy);
