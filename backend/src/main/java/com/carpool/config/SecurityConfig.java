package com.carpool.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.time.Duration;
import java.util.List;

@Configuration
public class SecurityConfig {

    private static final Logger log = LoggerFactory.getLogger(SecurityConfig.class);

    // Rules:
    // - Anyone can LOOK at rides (GET).
    // - Posting, booking, cancelling and deleting need a valid Clerk login token.
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(Customizer.withDefaults())
                .csrf(AbstractHttpConfigurer::disable)

                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/error").permitAll()
                        .requestMatchers("/ws", "/ws/**").permitAll()

                        // Tracking requires login
                        .requestMatchers(HttpMethod.GET, "/api/rides/*/tracking").authenticated()

                        // Anyone can view rides
                        .requestMatchers(
                                HttpMethod.GET,
                                "/", "/db-check", "/api/rides", "/api/rides/**")
                        .permitAll()

                        // All other operations require login
                        .anyRequest().authenticated())

                // IMPORTANT: Enable Clerk JWT authentication
                .oauth2ResourceServer(oauth2 -> oauth2
                        .jwt(Customizer.withDefaults()));

        return http.build();
    }

    // Checks the Clerk login token using Clerk's public keys (the JWKS URL).
    // This URL is public (not a secret), so it is safe to keep in the project.
    // Find yours in the Clerk dashboard -> API keys -> "JWKS URL".
    @Bean
    public JwtDecoder jwtDecoder(
            @Value("${clerk.jwks-url:https://immortal-mouse-1869.clerk.accounts.dev/.well-known/jwks.json}") String jwksUrl,
            @Value("${clerk.clock-skew-seconds:60}") long clockSkewSeconds) {
        log.info("Checking Clerk logins against {}", jwksUrl);
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(jwksUrl).build();

        // How far this computer's clock may differ from Clerk's clock.
        // 60 seconds is the normal value. If your PC clock is wrong you get
        // "Jwt used before ..." errors: fix the clock (best), or raise this
        // number in application-local.properties for local testing only.
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                new JwtTimestampValidator(Duration.ofSeconds(clockSkewSeconds))));

        // Same as the normal decoder, but prints WHY a login token was refused
        return token -> {
            try {
                return decoder.decode(token);
            } catch (JwtException e) {
                log.error("LOGIN TOKEN REJECTED: {}", e.getMessage());
                throw e;
            }
        };
    }

    // Which website may call this API (your Next.js app)
    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${app.cors.allowed-origin:http://localhost:3000}") String allowedOrigin) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(List.of(allowedOrigin, "http://localhost:*", "http://127.0.0.1:*"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}