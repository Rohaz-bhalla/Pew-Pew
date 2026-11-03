package com.carpool.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;

@RestController
public class DbCheckController {

    private static final Logger log = LoggerFactory.getLogger(DbCheckController.class);

    @Autowired
    private DataSource dataSource;

    // Open http://localhost:8080/db-check to test the Neon connection.
    // Delete this controller before you deploy.
    @GetMapping("/db-check")
    public String checkDatabaseConnection() {
        try (Connection connection = dataSource.getConnection()) {
            if (connection != null && !connection.isClosed()) {
                return "✅ Database Connection Successful! Connected to Neon PostgreSQL.";
            }
            return "❌ Database Connection Failed: Connection is closed.";
        } catch (Exception e) {
            // The real reason goes to the backend log, not to the browser
            log.error("Database check failed", e);
            return "❌ Database Connection Failed. See the backend console for the reason.";
        }
    }
}