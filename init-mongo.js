db.createUser(
    {
        user: "ghost-server",
        pwd:  "ghost-server-password",
        roles: [
            {
                role: "readWrite",
                db:   "ghostdb"
            }
        ]
    }
);