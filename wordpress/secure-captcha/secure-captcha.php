<?php
/**
 * Plugin Name: Secure CAPTCHA
 * Plugin URI: https://github.com/sreekanthvaripalli/secure-captcha-plugin
 * Description: Enterprise-grade, non-crackable CAPTCHA solution for WordPress. Protects forms, login, registration, and WooCommerce with advanced bot detection.
 * Version: 1.0.0
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * Author: Secure CAPTCHA Team
 * Author URI: https://github.com/sreekanthvaripalli
 * License: MIT
 * License URI: https://opensource.org/licenses/MIT
 * Text Domain: secure-captcha
 * Domain Path: /languages
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('SECURE_CAPTCHA_VERSION', '1.0.0');
define('SECURE_CAPTCHA_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('SECURE_CAPTCHA_PLUGIN_URL', plugin_dir_url(__FILE__));
define('SECURE_CAPTCHA_PLUGIN_BASENAME', plugin_basename(__FILE__));

/**
 * Main Secure CAPTCHA Plugin Class
 */
final class Secure_Captcha_Plugin {
    
    /**
     * Single instance of the plugin
     */
    private static $instance = null;
    
    /**
     * API endpoint
     */
    private $api_endpoint = '';
    
    /**
     * Plugin settings
     */
    private $settings = array();
    
    /**
     * Get single instance
     */
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    /**
     * Constructor
     */
    private function __construct() {
        $this->load_settings();
        $this->init_hooks();
    }
    
    /**
     * Load plugin settings
     */
    private function load_settings() {
        $defaults = array(
            'enabled' => true,
            'api_url' => 'http://localhost:3000/api/v1/captcha',
            'api_key' => '',
            'captcha_type' => 'text',
            'difficulty' => 'medium',
            'theme' => 'light',
            'enable_login' => true,
            'enable_registration' => true,
            'enable_comments' => true,
            'enable_password_reset' => true,
            'enable_woocommerce_checkout' => true,
            'enable_woocommerce_login' => true,
            'enable_contact_form_7' => true,
            'enable_wpforms' => true,
            'enable_gravity_forms' => true,
            'enable_ninja_forms' => true,
        );
        
        $this->settings = wp_parse_args(get_option('secure_captcha_settings', array()), $defaults);
    }
    
    /**
     * Initialize hooks
     */
    private function init_hooks() {
        // Activation/Deactivation
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
        
        // Admin
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));
        add_action('admin_enqueue_scripts', array($this, 'admin_enqueue_scripts'));
        
        // Frontend
        add_action('wp_enqueue_scripts', array($this, 'frontend_enqueue_scripts'));
        add_action('wp_footer', array($this, 'render_widget_container'));
        
        // Shortcode
        add_shortcode('secure_captcha', array($this, 'shortcode_handler'));
        
        // Widget
        add_action('widgets_init', array($this, 'register_widget'));
        
        // Login/Registration
        if ($this->settings['enable_login']) {
            add_action('login_form', array($this, 'render_captcha'));
            add_filter('authenticate', array($this, 'validate_login_captcha'), 30, 3);
        }
        
        if ($this->settings['enable_registration']) {
            add_action('register_form', array($this, 'render_captcha'));
            add_action('register_post', array($this, 'validate_registration_captcha'), 10, 3);
        }
        
        if ($this->settings['enable_password_reset']) {
            add_action('lostpassword_form', array($this, 'render_captcha'));
            add_action('lostpassword_post', array($this, 'validate_password_reset_captcha'));
        }
        
        // Comments
        if ($this->settings['enable_comments']) {
            add_action('comment_form', array($this, 'render_captcha'));
            add_filter('preprocess_comment', array($this, 'validate_comment_captcha'));
        }
        
        // WooCommerce
        if (class_exists('WooCommerce')) {
            if ($this->settings['enable_woocommerce_checkout']) {
                add_action('woocommerce_review_order_before_submit', array($this, 'render_captcha'));
                add_action('woocommerce_checkout_process', array($this, 'validate_woocommerce_captcha'));
            }
            if ($this->settings['enable_woocommerce_login']) {
                add_action('woocommerce_login_form', array($this, 'render_captcha'));
                add_filter('woocommerce_process_login_errors', array($this, 'validate_woocommerce_login_captcha'), 10, 2);
            }
        }
        
        // Contact Form 7
        if ($this->settings['enable_contact_form_7']) {
            add_action('wpcf7_init', array($this, 'init_contact_form_7'));
        }
        
        // WPForms
        if ($this->settings['enable_wpforms']) {
            add_action('wpforms_display_form_before', array($this, 'render_captcha'), 10, 2);
            add_filter('wpforms_process', array($this, 'validate_wpforms_captcha'), 10, 3);
        }
        
        // Gravity Forms
        if ($this->settings['enable_gravity_forms']) {
            add_action('gform_field_standard_settings', array($this, 'gravity_forms_settings'), 10, 2);
            add_filter('gform_pre_render', array($this, 'gravity_forms_render'));
            add_filter('gform_validation', array($this, 'gravity_forms_validate'));
        }
        
        // Ninja Forms
        if ($this->settings['enable_ninja_forms']) {
            add_action('ninja_forms_display_after_form', array($this, 'render_captcha'));
            add_filter('ninja_forms_submit_data', array($this, 'validate_ninja_forms_captcha'));
        }
        
        // AJAX handlers
        add_action('wp_ajax_secure_captcha_generate', array($this, 'ajax_generate_captcha'));
        add_action('wp_ajax_nopriv_secure_captcha_generate', array($this, 'ajax_generate_captcha'));
        add_action('wp_ajax_secure_captcha_validate', array($this, 'ajax_validate_captcha'));
        add_action('wp_ajax_nopriv_secure_captcha_validate', array($this, 'ajax_validate_captcha'));
    }
    
    /**
     * Activation hook
     */
    public function activate() {
        update_option('secure_captcha_settings', $this->settings);
        update_option('secure_captcha_version', SECURE_CAPTCHA_VERSION);
        flush_rewrite_rules();
    }
    
    /**
     * Deactivation hook
     */
    public function deactivate() {
        flush_rewrite_rules();
    }
    
    /**
     * Add admin menu
     */
    public function add_admin_menu() {
        add_options_page(
            __('Secure CAPTCHA Settings', 'secure-captcha'),
            __('Secure CAPTCHA', 'secure-captcha'),
            'manage_options',
            'secure-captcha',
            array($this, 'render_admin_page')
        );
    }
    
    /**
     * Register settings
     */
    public function register_settings() {
        register_setting('secure_captcha_settings', 'secure_captcha_settings', array(
            'sanitize_callback' => array($this, 'sanitize_settings'),
        ));
        
        add_settings_section(
            'secure_captcha_general',
            __('General Settings', 'secure-captcha'),
            array($this, 'render_general_section'),
            'secure-captcha'
        );
        
        add_settings_section(
            'secure_captcha_api',
            __('API Configuration', 'secure-captcha'),
            array($this, 'render_api_section'),
            'secure-captcha'
        );
        
        add_settings_section(
            'secure_captcha_protection',
            __('Protection Settings', 'secure-captcha'),
            array($this, 'render_protection_section'),
            'secure-captcha'
        );
        
        // General settings fields
        add_settings_field('enabled', __('Enable CAPTCHA', 'secure-captcha'), array($this, 'render_enabled_field'), 'secure-captcha', 'secure_captcha_general');
        add_settings_field('captcha_type', __('CAPTCHA Type', 'secure-captcha'), array($this, 'render_captcha_type_field'), 'secure-captcha', 'secure_captcha_general');
        add_settings_field('difficulty', __('Difficulty', 'secure-captcha'), array($this, 'render_difficulty_field'), 'secure-captcha', 'secure_captcha_general');
        add_settings_field('theme', __('Theme', 'secure-captcha'), array($this, 'render_theme_field'), 'secure-captcha', 'secure_captcha_general');
        
        // API settings fields
        add_settings_field('api_url', __('API URL', 'secure-captcha'), array($this, 'render_api_url_field'), 'secure-captcha', 'secure_captcha_api');
        add_settings_field('api_key', __('API Key', 'secure-captcha'), array($this, 'render_api_key_field'), 'secure-captcha', 'secure_captcha_api');
        
        // Protection settings fields
        add_settings_field('enable_login', __('Login Form', 'secure-captcha'), array($this, 'render_checkbox_field'), 'secure-captcha', 'secure_captcha_protection', array('field' => 'enable_login'));
        add_settings_field('enable_registration', __('Registration Form', 'secure-captcha'), array($this, 'render_checkbox_field'), 'secure-captcha', 'secure_captcha_protection', array('field' => 'enable_registration'));
        add_settings_field('enable_comments', __('Comments Form', 'secure-captcha'), array($this, 'render_checkbox_field'), 'secure-captcha', 'secure_captcha_protection', array('field' => 'enable_comments'));
        add_settings_field('enable_password_reset', __('Password Reset', 'secure-captcha'), array($this, 'render_checkbox_field'), 'secure-captcha', 'secure_captcha_protection', array('field' => 'enable_password_reset'));
        
        if (class_exists('WooCommerce')) {
            add_settings_field('enable_woocommerce_checkout', __('WooCommerce Checkout', 'secure-captcha'), array($this, 'render_checkbox_field'), 'secure-captcha', 'secure_captcha_protection', array('field' => 'enable_woocommerce_checkout'));
            add_settings_field('enable_woocommerce_login', __('WooCommerce Login', 'secure-captcha'), array($this, 'render_checkbox_field'), 'secure-captcha', 'secure_captcha_protection', array('field' => 'enable_woocommerce_login'));
        }
        
        if (defined('WPCF7_VERSION')) {
            add_settings_field('enable_contact_form_7', __('Contact Form 7', 'secure-captcha'), array($this, 'render_checkbox_field'), 'secure-captcha', 'secure_captcha_protection', array('field' => 'enable_contact_form_7'));
        }
        
        if (defined('WPFORMS_VERSION')) {
            add_settings_field('enable_wpforms', __('WPForms', 'secure-captcha'), array($this, 'render_checkbox_field'), 'secure-captcha', 'secure_captcha_protection', array('field' => 'enable_wpforms'));
        }
        
        if (class_exists('GFForms')) {
            add_settings_field('enable_gravity_forms', __('Gravity Forms', 'secure-captcha'), array($this, 'render_checkbox_field'), 'secure-captcha', 'secure_captcha_protection', array('field' => 'enable_gravity_forms'));
        }
        
        if (defined('NINJA_FORMS_VERSION')) {
            add_settings_field('enable_ninja_forms', __('Ninja Forms', 'secure-captcha'), array($this, 'render_checkbox_field'), 'secure-captcha', 'secure_captcha_protection', array('field' => 'enable_ninja_forms'));
        }
    }
    
    /**
     * Sanitize settings
     */
    public function sanitize_settings($input) {
        $sanitized = array();
        $sanitized['enabled'] = isset($input['enabled']) ? 1 : 0;
        $sanitized['api_url'] = esc_url_raw($input['api_url']);
        $sanitized['api_key'] = sanitize_text_field($input['api_key']);
        $sanitized['captcha_type'] = in_array($input['captcha_type'], array('text', 'math', 'logic', 'image')) ? $input['captcha_type'] : 'text';
        $sanitized['difficulty'] = in_array($input['difficulty'], array('easy', 'medium', 'hard')) ? $input['difficulty'] : 'medium';
        $sanitized['theme'] = in_array($input['theme'], array('light', 'dark')) ? $input['theme'] : 'light';
        $sanitized['enable_login'] = isset($input['enable_login']) ? 1 : 0;
        $sanitized['enable_registration'] = isset($input['enable_registration']) ? 1 : 0;
        $sanitized['enable_comments'] = isset($input['enable_comments']) ? 1 : 0;
        $sanitized['enable_password_reset'] = isset($input['enable_password_reset']) ? 1 : 0;
        $sanitized['enable_woocommerce_checkout'] = isset($input['enable_woocommerce_checkout']) ? 1 : 0;
        $sanitized['enable_woocommerce_login'] = isset($input['enable_woocommerce_login']) ? 1 : 0;
        $sanitized['enable_contact_form_7'] = isset($input['enable_contact_form_7']) ? 1 : 0;
        $sanitized['enable_wpforms'] = isset($input['enable_wpforms']) ? 1 : 0;
        $sanitized['enable_gravity_forms'] = isset($input['enable_gravity_forms']) ? 1 : 0;
        $sanitized['enable_ninja_forms'] = isset($input['enable_ninja_forms']) ? 1 : 0;
        
        return $sanitized;
    }
    
    /**
     * Render admin page
     */
    public function render_admin_page() {
        if (!current_user_can('manage_options')) {
            return;
        }
        ?>
        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
            <form method="post" action="options.php">
                <?php
                settings_fields('secure_captcha_settings');
                do_settings_sections('secure-captcha');
                submit_button();
                ?>
            </form>
        </div>
        <?php
    }
    
    /**
     * Render section descriptions
     */
    public function render_general_section() {
        echo '<p>' . esc_html__('Configure the basic CAPTCHA settings.', 'secure-captcha') . '</p>';
    }
    
    public function render_api_section() {
        echo '<p>' . esc_html__('Configure the connection to the Secure CAPTCHA API server.', 'secure-captcha') . '</p>';
    }
    
    public function render_protection_section() {
        echo '<p>' . esc_html__('Select which forms should be protected with CAPTCHA.', 'secure-captcha') . '</p>';
    }
    
    /**
     * Render settings fields
     */
    public function render_enabled_field() {
        $checked = $this->settings['enabled'] ? 'checked' : '';
        echo '<label><input type="checkbox" name="secure_captcha_settings[enabled]" value="1" ' . $checked . '> ' . esc_html__('Enable CAPTCHA protection', 'secure-captcha') . '</label>';
    }
    
    public function render_captcha_type_field() {
        $types = array(
            'text' => __('Text', 'secure-captcha'),
            'math' => __('Math', 'secure-captcha'),
            'logic' => __('Logic', 'secure-captcha'),
            'image' => __('Image', 'secure-captcha'),
        );
        echo '<select name="secure_captcha_settings[captcha_type]">';
        foreach ($types as $value => $label) {
            $selected = selected($this->settings['captcha_type'], $value, false);
            echo "<option value='{$value}' {$selected}>{$label}</option>";
        }
        echo '</select>';
    }
    
    public function render_difficulty_field() {
        $difficulties = array(
            'easy' => __('Easy', 'secure-captcha'),
            'medium' => __('Medium', 'secure-captcha'),
            'hard' => __('Hard', 'secure-captcha'),
        );
        echo '<select name="secure_captcha_settings[difficulty]">';
        foreach ($difficulties as $value => $label) {
            $selected = selected($this->settings['difficulty'], $value, false);
            echo "<option value='{$value}' {$selected}>{$label}</option>";
        }
        echo '</select>';
    }
    
    public function render_theme_field() {
        $themes = array(
            'light' => __('Light', 'secure-captcha'),
            'dark' => __('Dark', 'secure-captcha'),
        );
        echo '<select name="secure_captcha_settings[theme]">';
        foreach ($themes as $value => $label) {
            $selected = selected($this->settings['theme'], $value, false);
            echo "<option value='{$value}' {$selected}>{$label}</option>";
        }
        echo '</select>';
    }
    
    public function render_api_url_field() {
        echo '<input type="url" name="secure_captcha_settings[api_url]" value="' . esc_attr($this->settings['api_url']) . '" class="regular-text">';
        echo '<p class="description">' . esc_html__('URL of the Secure CAPTCHA API server (e.g., http://localhost:3000/api/v1/captcha)', 'secure-captcha') . '</p>';
    }
    
    public function render_api_key_field() {
        echo '<input type="text" name="secure_captcha_settings[api_key]" value="' . esc_attr($this->settings['api_key']) . '" class="regular-text">';
        echo '<p class="description">' . esc_html__('API key for authentication (optional)', 'secure-captcha') . '</p>';
    }
    
    public function render_checkbox_field($args) {
        $field = $args['field'];
        $checked = $this->settings[$field] ? 'checked' : '';
        echo '<label><input type="checkbox" name="secure_captcha_settings[' . $field . ']" value="1" ' . $checked . '> ' . esc_html__('Enable protection', 'secure-captcha') . '</label>';
    }
    
    /**
     * Enqueue admin scripts
     */
    public function admin_enqueue_scripts($hook) {
        if ('settings_page_secure-captcha' !== $hook) {
            return;
        }
        wp_enqueue_style('secure-captcha-admin', SECURE_CAPTCHA_PLUGIN_URL . 'assets/css/admin.css', array(), SECURE_CAPTCHA_VERSION);
    }
    
    /**
     * Enqueue frontend scripts
     */
    public function frontend_enqueue_scripts() {
        if (!$this->settings['enabled']) {
            return;
        }
        
        wp_enqueue_style('secure-captcha-frontend', SECURE_CAPTCHA_PLUGIN_URL . 'assets/css/frontend.css', array(), SECURE_CAPTCHA_VERSION);
        wp_enqueue_script('secure-captcha-frontend', SECURE_CAPTCHA_PLUGIN_URL . 'assets/js/frontend.js', array(), SECURE_CAPTCHA_VERSION, true);
        
        wp_localize_script('secure-captcha-frontend', 'secureCaptchaConfig', array(
            'apiUrl' => $this->settings['api_url'],
            'apiKey' => $this->settings['api_key'],
            'captchaType' => $this->settings['captcha_type'],
            'difficulty' => $this->settings['difficulty'],
            'theme' => $this->settings['theme'],
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('secure_captcha_nonce'),
        ));
    }
    
    /**
     * Render widget container in footer
     */
    public function render_widget_container() {
        if (!$this->settings['enabled']) {
            return;
        }
        echo '<div id="secure-captcha-widget-container" style="display:none;"></div>';
    }
    
    /**
     * Shortcode handler
     */
    public function shortcode_handler($atts) {
        if (!$this->settings['enabled']) {
            return '';
        }
        
        $atts = shortcode_atts(array(
            'type' => $this->settings['captcha_type'],
            'difficulty' => $this->settings['difficulty'],
            'theme' => $this->settings['theme'],
        ), $atts, 'secure_captcha');
        
        ob_start();
        $this->render_captcha();
        return ob_get_clean();
    }
    
    /**
     * Register widget
     */
    public function register_widget() {
        register_widget('Secure_Captcha_Widget');
    }
    
    /**
     * Render CAPTCHA HTML
     */
    public function render_captcha() {
        if (!$this->settings['enabled']) {
            return;
        }
        ?>
        <div class="secure-captcha-widget" 
             data-type="<?php echo esc_attr($this->settings['captcha_type']); ?>"
             data-difficulty="<?php echo esc_attr($this->settings['difficulty']); ?>"
             data-theme="<?php echo esc_attr($this->settings['theme']); ?>">
            <div class="secure-captcha-challenge"></div>
            <input type="text" class="secure-captcha-input" placeholder="<?php esc_attr_e('Enter CAPTCHA', 'secure-captcha'); ?>" required>
            <input type="hidden" class="secure-captcha-session" name="secure_captcha_session" value="">
            <input type="hidden" class="secure-captcha-response" name="secure_captcha_response" value="">
            <button type="button" class="secure-captcha-refresh" title="<?php esc_attr_e('Refresh CAPTCHA', 'secure-captcha'); ?>">↻</button>
            <div class="secure-captcha-error" style="display:none; color: #dc3232;"></div>
        </div>
        <?php
    }
    
    /**
     * AJAX: Generate CAPTCHA
     */
    public function ajax_generate_captcha() {
        check_ajax_referer('secure_captcha_nonce', 'nonce');
        
        $response = wp_remote_post(trailingslashit($this->settings['api_url']) . 'generate', array(
            'method' => 'POST',
            'headers' => array(
                'Content-Type' => 'application/json',
                'X-API-Key' => $this->settings['api_key'],
            ),
            'body' => wp_json_encode(array(
                'type' => isset($_POST['type']) ? sanitize_text_field($_POST['type']) : $this->settings['captcha_type'],
                'difficulty' => isset($_POST['difficulty']) ? sanitize_text_field($_POST['difficulty']) : $this->settings['difficulty'],
            )),
            'timeout' => 30,
        ));
        
        if (is_wp_error($response)) {
            wp_send_json_error($response->get_error_message());
            return;
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if (isset($data['sessionId']) && isset($data['challenge'])) {
            wp_send_json_success($data);
        } else {
            wp_send_json_error(__('Failed to generate CAPTCHA', 'secure-captcha'));
        }
    }
    
    /**
     * AJAX: Validate CAPTCHA
     */
    public function ajax_validate_captcha() {
        check_ajax_referer('secure_captcha_nonce', 'nonce');
        
        $session_id = isset($_POST['sessionId']) ? sanitize_text_field($_POST['sessionId']) : '';
        $response = isset($_POST['response']) ? sanitize_text_field($_POST['response']) : '';
        $type = isset($_POST['type']) ? sanitize_text_field($_POST['type']) : $this->settings['captcha_type'];
        
        $api_response = wp_remote_post(trailingslashit($this->settings['api_url']) . 'validate', array(
            'method' => 'POST',
            'headers' => array(
                'Content-Type' => 'application/json',
                'X-API-Key' => $this->settings['api_key'],
            ),
            'body' => wp_json_encode(array(
                'sessionId' => $session_id,
                'response' => $response,
                'type' => $type,
            )),
            'timeout' => 30,
        ));
        
        if (is_wp_error($api_response)) {
            wp_send_json_error($api_response->get_error_message());
            return;
        }
        
        $body = wp_remote_retrieve_body($api_response);
        $data = json_decode($body, true);
        
        if (isset($data['valid'])) {
            wp_send_json_success($data);
        } else {
            wp_send_json_error(__('Failed to validate CAPTCHA', 'secure-captcha'));
        }
    }
    
    /**
     * Validate login CAPTCHA
     */
    public function validate_login_captcha($user, $username, $password) {
        if (!$this->settings['enabled'] || !isset($_POST['secure_captcha_session'])) {
            return $user;
        }
        
        $session_id = sanitize_text_field($_POST['secure_captcha_session']);
        $response = isset($_POST['secure_captcha_response']) ? sanitize_text_field($_POST['secure_captcha_response']) : '';
        
        if (empty($session_id) || empty($response)) {
            return new WP_Error('captcha_required', __('<strong>Error</strong>: Please complete the CAPTCHA.', 'secure-captcha'));
        }
        
        $validation = $this->validate_captcha_api($session_id, $response);
        
        if (is_wp_error($validation)) {
            return $validation;
        }
        
        return $user;
    }
    
    /**
     * Validate registration CAPTCHA
     */
    public function validate_registration_captcha($sanitized_user_login, $user_email, $errors) {
        if (!$this->settings['enabled'] || !isset($_POST['secure_captcha_session'])) {
            return;
        }
        
        $session_id = sanitize_text_field($_POST['secure_captcha_session']);
        $response = isset($_POST['secure_captcha_response']) ? sanitize_text_field($_POST['secure_captcha_response']) : '';
        
        if (empty($session_id) || empty($response)) {
            $errors->add('captcha_required', __('<strong>Error</strong>: Please complete the CAPTCHA.', 'secure-captcha'));
            return;
        }
        
        $validation = $this->validate_captcha_api($session_id, $response);
        
        if (is_wp_error($validation)) {
            $errors->add('captcha_error', $validation->get_error_message());
        }
    }
    
    /**
     * Validate password reset CAPTCHA
     */
    public function validate_password_reset_captcha($errors) {
        if (!$this->settings['enabled'] || !isset($_POST['secure_captcha_session'])) {
            return;
        }
        
        $session_id = sanitize_text_field($_POST['secure_captcha_session']);
        $response = isset($_POST['secure_captcha_response']) ? sanitize_text_field($_POST['secure_captcha_response']) : '';
        
        if (empty($session_id) || empty($response)) {
            $errors->add('captcha_required', __('<strong>Error</strong>: Please complete the CAPTCHA.', 'secure-captcha'));
            return;
        }
        
        $validation = $this->validate_captcha_api($session_id, $response);
        
        if (is_wp_error($validation)) {
            $errors->add('captcha_error', $validation->get_error_message());
        }
    }
    
    /**
     * Validate comment CAPTCHA
     */
    public function validate_comment_captcha($commentdata) {
        if (!$this->settings['enabled'] || !isset($_POST['secure_captcha_session'])) {
            return $commentdata;
        }
        
        $session_id = sanitize_text_field($_POST['secure_captcha_session']);
        $response = isset($_POST['secure_captcha_response']) ? sanitize_text_field($_POST['secure_captcha_response']) : '';
        
        if (empty($session_id) || empty($response)) {
            wp_die(__('<strong>Error</strong>: Please complete the CAPTCHA.', 'secure-captcha'));
        }
        
        $validation = $this->validate_captcha_api($session_id, $response);
        
        if (is_wp_error($validation)) {
            wp_die($validation->get_error_message());
        }
        
        return $commentdata;
    }
    
    /**
     * Validate WooCommerce checkout CAPTCHA
     */
    public function validate_woocommerce_captcha() {
        if (!$this->settings['enabled'] || !isset($_POST['secure_captcha_session'])) {
            return;
        }
        
        $session_id = sanitize_text_field($_POST['secure_captcha_session']);
        $response = isset($_POST['secure_captcha_response']) ? sanitize_text_field($_POST['secure_captcha_response']) : '';
        
        if (empty($session_id) || empty($response)) {
            wc_add_notice(__('Please complete the CAPTCHA.', 'secure-captcha'), 'error');
            return;
        }
        
        $validation = $this->validate_captcha_api($session_id, $response);
        
        if (is_wp_error($validation)) {
            wc_add_notice($validation->get_error_message(), 'error');
        }
    }
    
    /**
     * Validate WooCommerce login CAPTCHA
     */
    public function validate_woocommerce_login_captcha($validation_errors, $username) {
        if (!$this->settings['enabled'] || !isset($_POST['secure_captcha_session'])) {
            return $validation_errors;
        }
        
        $session_id = sanitize_text_field($_POST['secure_captcha_session']);
        $response = isset($_POST['secure_captcha_response']) ? sanitize_text_field($_POST['secure_captcha_response']) : '';
        
        if (empty($session_id) || empty($response)) {
            $validation_errors->add('captcha_required', __('Please complete the CAPTCHA.', 'secure-captcha'));
            return $validation_errors;
        }
        
        $validation = $this->validate_captcha_api($session_id, $response);
        
        if (is_wp_error($validation)) {
            $validation_errors->add('captcha_error', $validation->get_error_message());
        }
        
        return $validation_errors;
    }
    
    /**
     * Validate CAPTCHA via API
     */
    private function validate_captcha_api($session_id, $response) {
        $api_response = wp_remote_post(trailingslashit($this->settings['api_url']) . 'validate', array(
            'method' => 'POST',
            'headers' => array(
                'Content-Type' => 'application/json',
                'X-API-Key' => $this->settings['api_key'],
            ),
            'body' => wp_json_encode(array(
                'sessionId' => $session_id,
                'response' => $response,
                'type' => $this->settings['captcha_type'],
            )),
            'timeout' => 30,
        ));
        
        if (is_wp_error($api_response)) {
            return new WP_Error('captcha_api_error', sprintf(__('<strong>Error</strong>: CAPTCHA validation failed: %s', 'secure-captcha'), $api_response->get_error_message()));
        }
        
        $body = wp_remote_retrieve_body($api_response);
        $data = json_decode($body, true);
        
        if (isset($data['valid']) && $data['valid']) {
            return true;
        }
        
        $message = isset($data['message']) ? $data['message'] : __('Invalid CAPTCHA response.', 'secure-captcha');
        return new WP_Error('captcha_invalid', sprintf(__('<strong>Error</strong>: %s', 'secure-captcha'), $message));
    }
    
    /**
     * Initialize Contact Form 7 integration
     */
    public function init_contact_form_7() {
        if (function_exists('wpcf7_add_form_tag')) {
            wpcf7_add_form_tag('secure_captcha', array($this, 'contact_form_7_tag_handler'), true);
            wpcf7_add_form_tag('secure_captcha*', array($this, 'contact_form_7_tag_handler'), true);
            wpcf7_add_filter('wpcf7_validate_secure_captcha', array($this, 'contact_form_7_validation'), 10, 2);
            wpcf7_add_filter('wpcf7_validate_secure_captcha*', array($this, 'contact_form_7_validation'), 10, 2);
        }
    }
    
    /**
     * Contact Form 7 tag handler
     */
    public function contact_form_7_tag_handler($tag) {
        if (!$this->settings['enabled']) {
            return '';
        }
        ob_start();
        $this->render_captcha();
        return ob_get_clean();
    }
    
    /**
     * Contact Form 7 validation
     */
    public function contact_form_7_validation($result, $tag) {
        if (!$this->settings['enabled'] || !isset($_POST['secure_captcha_session'])) {
            return $result;
        }
        
        $session_id = sanitize_text_field($_POST['secure_captcha_session']);
        $response = isset($_POST['secure_captcha_response']) ? sanitize_text_field($_POST['secure_captcha_response']) : '';
        
        if (empty($session_id) || empty($response)) {
            $result->invalidate($tag, __('Please complete the CAPTCHA.', 'secure-captcha'));
            return $result;
        }
        
        $validation = $this->validate_captcha_api($session_id, $response);
        
        if (is_wp_error($validation)) {
            $result->invalidate($tag, $validation->get_error_message());
        }
        
        return $result;
    }
    
    /**
     * Validate WPForms CAPTCHA
     */
    public function validate_wpforms_captcha($fields, $entry, $form_data) {
        if (!$this->settings['enabled'] || !isset($_POST['secure_captcha_session'])) {
            return $fields;
        }
        
        $session_id = sanitize_text_field($_POST['secure_captcha_session']);
        $response = isset($_POST['secure_captcha_response']) ? sanitize_text_field($_POST['secure_captcha_response']) : '';
        
        if (empty($session_id) || empty($response)) {
            wpforms()->process->errors[$form_data['id']]['header'] = __('Please complete the CAPTCHA.', 'secure-captcha');
            return $fields;
        }
        
        $validation = $this->validate_captcha_api($session_id, $response);
        
        if (is_wp_error($validation)) {
            wpforms()->process->errors[$form_data['id']]['header'] = $validation->get_error_message();
        }
        
        return $fields;
    }
    
    /**
     * Gravity Forms settings
     */
    public function gravity_forms_settings($position, $form_id) {
        if ($position !== 1100) {
            return;
        }
        ?>
        <li class="secure_captcha_setting field_setting">
            <label for="field_secure_captcha">
                <input type="checkbox" id="field_secure_captcha" onclick="SetFieldProperty('secureCaptcha', this.checked);" />
                <?php esc_html_e('Enable Secure CAPTCHA', 'secure-captcha'); ?>
            </label>
        </li>
        <?php
    }
    
    /**
     * Gravity Forms render
     */
    public function gravity_forms_render($form) {
        if (!$this->settings['enabled']) {
            return $form;
        }
        
        foreach ($form['fields'] as &$field) {
            if (rgar($field, 'secureCaptcha')) {
                $field['type'] = 'html';
                ob_start();
                $this->render_captcha();
                $field['content'] = ob_get_clean();
            }
        }
        
        return $form;
    }
    
    /**
     * Gravity Forms validation
     */
    public function gravity_forms_validate($validation_result) {
        if (!$this->settings['enabled'] || !isset($_POST['secure_captcha_session'])) {
            return $validation_result;
        }
        
        $session_id = sanitize_text_field($_POST['secure_captcha_session']);
        $response = isset($_POST['secure_captcha_response']) ? sanitize_text_field($_POST['secure_captcha_response']) : '';
        
        if (empty($session_id) || empty($response)) {
            $validation_result['is_valid'] = false;
            return $validation_result;
        }
        
        $validation = $this->validate_captcha_api($session_id, $response);
        
        if (is_wp_error($validation)) {
            $validation_result['is_valid'] = false;
        }
        
        return $validation_result;
    }
    
    /**
     * Validate Ninja Forms CAPTCHA
     */
    public function validate_ninja_forms_captcha($form_data) {
        if (!$this->settings['enabled'] || !isset($_POST['secure_captcha_session'])) {
            return $form_data;
        }
        
        $session_id = sanitize_text_field($_POST['secure_captcha_session']);
        $response = isset($_POST['secure_captcha_response']) ? sanitize_text_field($_POST['secure_captcha_response']) : '';
        
        if (empty($session_id) || empty($response)) {
            Ninja_Forms()->user_errors[] = __('Please complete the CAPTCHA.', 'secure-captcha');
            return $form_data;
        }
        
        $validation = $this->validate_captcha_api($session_id, $response);
        
        if (is_wp_error($validation)) {
            Ninja_Forms()->user_errors[] = $validation->get_error_message();
        }
        
        return $form_data;
    }
}

/**
 * Secure CAPTCHA Widget Class
 */
class Secure_Captcha_Widget extends WP_Widget {
    
    public function __construct() {
        parent::__construct(
            'secure_captcha_widget',
            __('Secure CAPTCHA', 'secure-captcha'),
            array('description' => __('Add CAPTCHA protection to any widget area', 'secure-captcha'))
        );
    }
    
    public function widget($args, $instance) {
        echo $args['before_widget'];
        
        if (!empty($instance['title'])) {
            echo $args['before_title'] . apply_filters('widget_title', $instance['title']) . $args['after_title'];
        }
        
        $plugin = Secure_Captcha_Plugin::get_instance();
        $plugin->render_captcha();
        
        echo $args['after_widget'];
    }
    
    public function form($instance) {
        $title = !empty($instance['title']) ? $instance['title'] : __('CAPTCHA', 'secure-captcha');
        ?>
        <p>
            <label for="<?php echo $this->get_field_id('title'); ?>"><?php esc_html_e('Title:', 'secure-captcha'); ?></label>
            <input class="widefat" id="<?php echo $this->get_field_id('title'); ?>" name="<?php echo $this->get_field_name('title'); ?>" type="text" value="<?php echo esc_attr($title); ?>">
        </p>
        <?php
    }
    
    public function update($new_instance, $old_instance) {
        $instance = array();
        $instance['title'] = (!empty($new_instance['title'])) ? sanitize_text_field($new_instance['title']) : '';
        return $instance;
    }
}

/**
 * Initialize the plugin
 */
function secure_captcha_init() {
    return Secure_Captcha_Plugin::get_instance();
}

secure_captcha_init();