<?php
/**
 * Secure CAPTCHA - WordPress Plugin Tests
 * 
 * These tests use PHPUnit and the WordPress test framework.
 * Run with: phpunit -c wordpress/secure-captcha/tests/phpunit.xml
 */

class SecureCaptchaTest extends WP_UnitTestCase {
    
    /**
     * Plugin instance
     */
    private $plugin;
    
    /**
     * Set up test fixtures
     */
    public function setUp(): void {
        parent::setUp();
        
        // Initialize the plugin
        $this->plugin = Secure_Captcha_Plugin::get_instance();
    }
    
    /**
     * Test plugin singleton
     */
    public function test_plugin_singleton() {
        $instance1 = Secure_Captcha_Plugin::get_instance();
        $instance2 = Secure_Captcha_Plugin::get_instance();
        
        $this->assertSame($instance1, $instance2);
    }
    
    /**
     * Test plugin activation
     */
    public function test_plugin_activation() {
        // Check that options are set
        $settings = get_option('secure_captcha_settings');
        $this->assertIsArray($settings);
        $this->assertArrayHasKey('enabled', $settings);
        $this->assertArrayHasKey('api_url', $settings);
        $this->assertArrayHasKey('captcha_type', $settings);
    }
    
    /**
     * Test default settings
     */
    public function test_default_settings() {
        $settings = get_option('secure_captcha_settings');
        
        $this->assertEquals(1, $settings['enabled']);
        $this->assertEquals('http://localhost:3000/api/v1/captcha', $settings['api_url']);
        $this->assertEquals('text', $settings['captcha_type']);
        $this->assertEquals('medium', $settings['difficulty']);
        $this->assertEquals('light', $settings['theme']);
        $this->assertEquals(1, $settings['enable_login']);
        $this->assertEquals(1, $settings['enable_registration']);
        $this->assertEquals(1, $settings['enable_comments']);
    }
    
    /**
     * Test settings sanitization
     */
    public function test_settings_sanitization() {
        $input = array(
            'enabled' => 1,
            'api_url' => 'https://example.com/api',
            'api_key' => '<script>alert("xss")</script>',
            'captcha_type' => 'math',
            'difficulty' => 'hard',
            'theme' => 'dark',
            'enable_login' => 1,
            'enable_registration' => 0,
        );
        
        $sanitized = $this->plugin->sanitize_settings($input);
        
        $this->assertEquals(1, $sanitized['enabled']);
        $this->assertEquals('https://example.com/api', $sanitized['api_url']);
        $this->assertEquals('alert("xss")', $sanitized['api_key']); // XSS stripped
        $this->assertEquals('math', $sanitized['captcha_type']);
        $this->assertEquals('hard', $sanitized['difficulty']);
        $this->assertEquals('dark', $sanitized['theme']);
        $this->assertEquals(1, $sanitized['enable_login']);
        $this->assertEquals(0, $sanitized['enable_registration']);
    }
    
    /**
     * Test invalid captcha type sanitization
     */
    public function test_invalid_captcha_type_sanitization() {
        $input = array(
            'captcha_type' => 'invalid_type',
            'difficulty' => 'invalid_difficulty',
            'theme' => 'invalid_theme',
        );
        
        $sanitized = $this->plugin->sanitize_settings($input);
        
        $this->assertEquals('text', $sanitized['captcha_type']); // Default
        $this->assertEquals('medium', $sanitized['difficulty']); // Default
        $this->assertEquals('light', $sanitized['theme']); // Default
    }
    
    /**
     * Test shortcode registration
     */
    public function test_shortcode_registered() {
        global $shortcode_tags;
        $this->assertArrayHasKey('secure_captcha', $shortcode_tags);
    }
    
    /**
     * Test shortcode output
     */
    public function test_shortcode_output() {
        $output = do_shortcode('[secure_captcha]');
        
        $this->assertStringContainsString('secure-captcha-widget', $output);
        $this->assertStringContainsString('secure-captcha-input', $output);
        $this->assertStringContainsString('secure-captcha-refresh', $output);
    }
    
    /**
     * Test shortcode with attributes
     */
    public function test_shortcode_with_attributes() {
        $output = do_shortcode('[secure_captcha type="math" difficulty="hard" theme="dark"]');
        
        $this->assertStringContainsString('data-type="math"', $output);
        $this->assertStringContainsString('data-difficulty="hard"', $output);
        $this->assertStringContainsString('data-theme="dark"', $output);
    }
    
    /**
     * Test widget registration
     */
    public function test_widget_registered() {
        global $wp_widget_factory;
        $this->assertArrayHasKey('Secure_Captcha_Widget', $wp_widget_factory->widgets);
    }
    
    /**
     * Test widget output
     */
    public function test_widget_output() {
        ob_start();
        $widget = new Secure_Captcha_Widget();
        $widget->widget(
            array(
                'before_widget' => '<div class="widget">',
                'after_widget' => '</div>',
                'before_title' => '<h2>',
                'after_title' => '</h2>',
            ),
            array('title' => 'Test CAPTCHA')
        );
        $output = ob_get_clean();
        
        $this->assertStringContainsString('<div class="widget">', $output);
        $this->assertStringContainsString('<h2>Test CAPTCHA</h2>', $output);
        $this->assertStringContainsString('secure-captcha-widget', $output);
    }
    
    /**
     * Test widget title sanitization
     */
    public function test_widget_title_sanitization() {
        $instance = array('title' => '<script>alert("xss")</script>');
        $new_instance = array('title' => '<script>alert("xss")</script>');
        $old_instance = array();
        
        $widget = new Secure_Captcha_Widget();
        $result = $widget->update($new_instance, $old_instance);
        
        $this->assertEquals('alert("xss")', $result['title']);
    }
    
    /**
     * Test admin menu registration
     */
    public function test_admin_menu_registered() {
        global $submenu;
        
        // Simulate admin menu
        do_action('admin_menu');
        
        $this->assertArrayHasKey('options-general.php', $submenu);
    }
    
    /**
     * Test frontend scripts enqueue
     */
    public function test_frontend_scripts_enqueued() {
        // Enable the plugin
        $settings = get_option('secure_captcha_settings');
        $settings['enabled'] = 1;
        update_option('secure_captcha_settings', $settings);
        
        // Simulate frontend
        do_action('wp_enqueue_scripts');
        
        global $wp_scripts;
        global $wp_styles;
        
        $this->assertArrayHasKey('secure-captcha-frontend', $wp_scripts->registered);
        $this->assertArrayHasKey('secure-captcha-frontend', $wp_styles->registered);
    }
    
    /**
     * Test frontend scripts not enqueued when disabled
     */
    public function test_frontend_scripts_not_enqueued_when_disabled() {
        // Disable the plugin
        $settings = get_option('secure_captcha_settings');
        $settings['enabled'] = 0;
        update_option('secure_captcha_settings', $settings);
        
        // Simulate frontend
        do_action('wp_enqueue_scripts');
        
        global $wp_scripts;
        global $wp_styles;
        
        $this->assertArrayNotHasKey('secure-captcha-frontend', $wp_scripts->registered);
        $this->assertArrayNotHasKey('secure-captcha-frontend', $wp_styles->registered);
    }
    
    /**
     * Test AJAX generate captcha nonce check
     */
    public function test_ajax_generate_captcha_nonce_check() {
        // Set up current user as non-logged in
        wp_set_current_user(0);
        
        // Call AJAX without nonce
        $_POST['nonce'] = 'invalid_nonce';
        $_POST['type'] = 'text';
        $_POST['difficulty'] = 'medium';
        
        // This should die with -1 due to nonce check
        $this->expectException('WPDieException');
        $this->plugin->ajax_generate_captcha();
    }
    
    /**
     * Test AJAX validate captcha nonce check
     */
    public function test_ajax_validate_captcha_nonce_check() {
        // Set up current user as non-logged in
        wp_set_current_user(0);
        
        // Call AJAX without nonce
        $_POST['nonce'] = 'invalid_nonce';
        $_POST['sessionId'] = 'test-session';
        $_POST['response'] = 'test-response';
        
        // This should die with -1 due to nonce check
        $this->expectException('WPDieException');
        $this->plugin->ajax_validate_captcha();
    }
    
    /**
     * Test render captcha HTML
     */
    public function test_render_captcha_html() {
        ob_start();
        $this->plugin->render_captcha();
        $output = ob_get_clean();
        
        $this->assertStringContainsString('secure-captcha-widget', $output);
        $this->assertStringContainsString('secure-captcha-challenge', $output);
        $this->assertStringContainsString('secure-captcha-input', $output);
        $this->assertStringContainsString('secure-captcha-session', $output);
        $this->assertStringContainsString('secure-captcha-response', $output);
        $this->assertStringContainsString('secure-captcha-refresh', $output);
        $this->assertStringContainsString('secure-captcha-error', $output);
    }
    
    /**
     * Test render captcha not shown when disabled
     */
    public function test_render_captcha_not_shown_when_disabled() {
        // Disable the plugin
        $settings = get_option('secure_captcha_settings');
        $settings['enabled'] = 0;
        update_option('secure_captcha_settings', $settings);
        
        ob_start();
        $this->plugin->render_captcha();
        $output = ob_get_clean();
        
        $this->assertEmpty($output);
    }
    
    /**
     * Test widget container rendered in footer
     */
    public function test_widget_container_in_footer() {
        ob_start();
        $this->plugin->render_widget_container();
        $output = ob_get_clean();
        
        $this->assertStringContainsString('secure-captcha-widget-container', $output);
    }
    
    /**
     * Test login captcha validation with empty session
     */
    public function test_login_captcha_validation_empty_session() {
        $_POST['secure_captcha_session'] = '';
        $_POST['secure_captcha_response'] = '';
        
        $user = new WP_User(1);
        $result = $this->plugin->validate_login_captcha($user, 'testuser', 'password');
        
        $this->assertInstanceOf('WP_Error', $result);
        $this->assertEquals('captcha_required', $result->get_error_code());
    }
    
    /**
     * Test registration captcha validation with empty session
     */
    public function test_registration_captcha_validation_empty_session() {
        $_POST['secure_captcha_session'] = '';
        $_POST['secure_captcha_response'] = '';
        
        $errors = new WP_Error();
        $this->plugin->validate_registration_captcha('testuser', 'test@example.com', $errors);
        
        $this->assertTrue($errors->has_errors());
        $this->assertEquals('captcha_required', $errors->get_error_code());
    }
    
    /**
     * Test comment captcha validation with empty session
     */
    public function test_comment_captcha_validation_empty_session() {
        $_POST['secure_captcha_session'] = '';
        $_POST['secure_captcha_response'] = '';
        
        $commentdata = array(
            'comment_post_ID' => 1,
            'comment_author' => 'Test',
            'comment_content' => 'Test comment',
        );
        
        // This should call wp_die
        $this->expectException('WPDieException');
        $this->plugin->validate_comment_captcha($commentdata);
    }
    
    /**
     * Test password reset captcha validation with empty session
     */
    public function test_password_reset_captcha_validation_empty_session() {
        $_POST['secure_captcha_session'] = '';
        $_POST['secure_captcha_response'] = '';
        
        $errors = new WP_Error();
        $this->plugin->validate_password_reset_captcha($errors);
        
        $this->assertTrue($errors->has_errors());
        $this->assertEquals('captcha_required', $errors->get_error_code());
    }
    
    /**
     * Test settings field rendering
     */
    public function test_settings_fields_render() {
        // Test enabled field
        ob_start();
        $this->plugin->render_enabled_field();
        $output = ob_get_clean();
        $this->assertStringContainsString('type="checkbox"', $output);
        $this->assertStringContainsString('name="secure_captcha_settings[enabled]"', $output);
        
        // Test captcha type field
        ob_start();
        $this->plugin->render_captcha_type_field();
        $output = ob_get_clean();
        $this->assertStringContainsString('<select', $output);
        $this->assertStringContainsString('text', $output);
        $this->assertStringContainsString('math', $output);
        $this->assertStringContainsString('logic', $output);
        $this->assertStringContainsString('image', $output);
        
        // Test difficulty field
        ob_start();
        $this->plugin->render_difficulty_field();
        $output = ob_get_clean();
        $this->assertStringContainsString('easy', $output);
        $this->assertStringContainsString('medium', $output);
        $this->assertStringContainsString('hard', $output);
        
        // Test theme field
        ob_start();
        $this->plugin->render_theme_field();
        $output = ob_get_clean();
        $this->assertStringContainsString('light', $output);
        $this->assertStringContainsString('dark', $output);
    }
    
    /**
     * Test API URL field rendering
     */
    public function test_api_url_field_render() {
        ob_start();
        $this->plugin->render_api_url_field();
        $output = ob_get_clean();
        
        $this->assertStringContainsString('type="url"', $output);
        $this->assertStringContainsString('name="secure_captcha_settings[api_url]"', $output);
        $this->assertStringContainsString('http://localhost:3000/api/v1/captcha', $output);
    }
    
    /**
     * Test API key field rendering
     */
    public function test_api_key_field_render() {
        ob_start();
        $this->plugin->render_api_key_field();
        $output = ob_get_clean();
        
        $this->assertStringContainsString('type="text"', $output);
        $this->assertStringContainsString('name="secure_captcha_settings[api_key]"', $output);
    }
    
    /**
     * Test checkbox field rendering
     */
    public function test_checkbox_field_render() {
        ob_start();
        $this->plugin->render_checkbox_field(array('field' => 'enable_login'));
        $output = ob_get_clean();
        
        $this->assertStringContainsString('type="checkbox"', $output);
        $this->assertStringContainsString('name="secure_captcha_settings[enable_login]"', $output);
    }
    
    /**
     * Test deactivation
     */
    public function test_plugin_deactivation() {
        $this->plugin->deactivate();
        
        // Plugin should still have settings after deactivation
        $settings = get_option('secure_captcha_settings');
        $this->assertIsArray($settings);
    }
    
    /**
     * Test plugin version constant
     */
    public function test_plugin_version_constant() {
        $this->assertEquals('1.0.0', SECURE_CAPTCHA_VERSION);
    }
    
    /**
     * Test plugin directory constant
     */
    public function test_plugin_dir_constant() {
        $this->assertStringContainsString('secure-captcha', SECURE_CAPTCHA_PLUGIN_DIR);
    }
    
    /**
     * Test plugin URL constant
     */
    public function test_plugin_url_constant() {
        $this->assertStringContainsString('secure-captcha', SECURE_CAPTCHA_PLUGIN_URL);
    }
    
    /**
     * Test init function returns plugin instance
     */
    public function test_init_function() {
        $instance = secure_captcha_init();
        $this->assertInstanceOf('Secure_Captcha_Plugin', $instance);
    }
}