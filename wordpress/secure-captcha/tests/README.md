# WordPress Plugin Testing Guide

## Prerequisites

- PHP 7.4 or higher
- MySQL 5.6 or higher
- PHPUnit 7.5 or higher
- Subversion (svn) command-line client
- WP-CLI (optional, for easier setup)

## Setup Test Environment

### Option 1: Using the Install Script (Recommended)

1. **Make the install script executable:**
   ```bash
   cd wordpress/secure-captcha
   chmod +x bin/install-wp-tests.sh
   ```

2. **Create a test database:**
   ```bash
   mysql -u root -p -e "CREATE DATABASE wordpress_test;"
   ```

3. **Run the install script:**
   ```bash
   bin/install-wp-tests.sh wordpress_test root '' localhost latest
   ```
   
   Replace the parameters with your database credentials:
   - `wordpress_test` - Database name
   - `root` - Database user
   - `''` - Database password (empty in this example)
   - `localhost` - Database host
   - `latest` - WordPress version to test against

### Option 2: Using WP-CLI

1. **Install WP-CLI** (if not already installed):
   ```bash
   curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
   chmod +x wp-cli.phar
   sudo mv wp-cli.phar /usr/local/bin/wp
   ```

2. **Set up test environment:**
   ```bash
   wp scaffold plugin-tests secure-captcha --path=/path/to/wordpress
   ```

## Running Tests

### Run All Tests

```bash
cd wordpress/secure-captcha
phpunit -c tests/phpunit.xml
```

### Run Specific Test

```bash
phpunit -c tests/phpunit.xml --filter test_plugin_singleton
```

### Run with Coverage

```bash
phpunit -c tests/phpunit.xml --coverage-html ./coverage
```

### Run with Verbose Output

```bash
phpunit -c tests/phpunit.xml --verbose
```

## Test Structure

```
wordpress/secure-captcha/
├── secure-captcha.php          # Main plugin file
├── assets/
│   ├── css/
│   │   ├── frontend.css        # Frontend styles
│   │   └── admin.css           # Admin styles
│   └── js/
│       └── frontend.js         # Frontend JavaScript
├── tests/
│   ├── phpunit.xml             # PHPUnit configuration
│   ├── bootstrap.php           # Test bootstrap file
│   ├── test-secure-captcha.php # Test cases
│   └── README.md               # This file
├── bin/
│   └── install-wp-tests.sh     # Test environment setup script
└── readme.txt                  # WordPress plugin documentation
```

## Test Categories

### Plugin Core Tests
- `test_plugin_singleton` - Tests singleton pattern
- `test_plugin_activation` - Tests activation hook
- `test_default_settings` - Tests default settings values
- `test_settings_sanitization` - Tests input sanitization
- `test_plugin_deactivation` - Tests deactivation hook

### Shortcode Tests
- `test_shortcode_registered` - Tests shortcode registration
- `test_shortcode_output` - Tests shortcode HTML output
- `test_shortcode_with_attributes` - Tests shortcode with custom attributes

### Widget Tests
- `test_widget_registered` - Tests widget registration
- `test_widget_output` - Tests widget HTML output
- `test_widget_title_sanitization` - Tests title sanitization

### Admin Tests
- `test_admin_menu_registered` - Tests admin menu registration
- `test_settings_fields_render` - Tests settings field rendering

### Frontend Tests
- `test_frontend_scripts_enqueued` - Tests script enqueue when enabled
- `test_frontend_scripts_not_enqueued_when_disabled` - Tests script disable

### AJAX Security Tests
- `test_ajax_generate_captcha_nonce_check` - Tests nonce validation
- `test_ajax_validate_captcha_nonce_check` - Tests nonce validation

### Form Validation Tests
- `test_login_captcha_validation_empty_session` - Tests login validation
- `test_registration_captcha_validation_empty_session` - Tests registration validation
- `test_comment_captcha_validation_empty_session` - Tests comment validation
- `test_password_reset_captcha_validation_empty_session` - Tests password reset validation

## Troubleshooting

### "Could not find wordpress-tests-lib"
Run the install script:
```bash
bin/install-wp-tests.sh wordpress_test root '' localhost latest
```

### "Class WP_UnitTestCase not found"
Ensure the WordPress test library is properly installed:
```bash
echo $WP_TESTS_DIR
```
Should output: `/tmp/wordpress-tests-lib`

### Database Connection Errors
Verify your database credentials in the install script command:
```bash
bin/install-wp-tests.sh wordpress_test your_user your_password localhost latest
```

## CI/CD Integration

Add to your GitHub Actions workflow:

```yaml
name: WordPress Plugin Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mysql:
        image: mysql:5.7
        env:
          MYSQL_ROOT_PASSWORD: root
        ports:
          - 3306:3306
        options: --health-cmd="mysqladmin ping" --health-interval=10s --health-timeout=5s --health-retries=3
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '7.4'
          extensions: mysql
      
      - name: Install PHPUnit
        run: |
          wget -O phpunit https://phar.phpunit.de/phpunit-7.phar
          chmod +x phpunit
          sudo mv phpunit /usr/local/bin/phpunit
      
      - name: Setup WordPress Test Environment
        run: |
          cd wordpress/secure-captcha
          chmod +x bin/install-wp-tests.sh
          bin/install-wp-tests.sh wordpress_test root root 127.0.0.1 latest
      
      - name: Run Tests
        run: |
          cd wordpress/secure-captcha
          phpunit -c tests/phpunit.xml