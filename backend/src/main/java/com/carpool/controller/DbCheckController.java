package com.carpool.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;

@RestController
public class DbCheckController {

    private static final Logger log = LoggerFactory.getLogger(DbCheckController.class);

    private final DataSource dataSource;

    // Constructor Injection
    public DbCheckController(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @GetMapping("/db-check")
    public String checkDatabaseConnection() {

        try (Connection connection = dataSource.getConnection()) {

            if (connection != null && !connection.isClosed()) {
                return "Database Connection Successful! Connected to Neon PostgreSQL.";
            }

            return "Database Connection Failed: Connection is closed.";

        } catch (Exception e) {

            log.error("Database check failed", e);

            return "Database Connection Failed. See the backend console for the reason.";
        }
    }
}