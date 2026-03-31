=== Secure CAPTCHA ===
Contributors: sreekanthvaripalli
Tags: captcha, security, anti-bot, spam protection, login security
Requires at least: 5.8
Tested up to: 6.4
Requires PHP: 7.4
Stable tag: 1.0.0
License: MIT
License URI: https://opensource.org/licenses/MIT

Enterprise-grade, non-crackable CAPTCHA solution for WordPress. Protects forms, login, registration, and WooCommerce with advanced bot detection.

== Description ==

Secure CAPTCHA is an enterprise-grade CAPTCHA solution designed to provide robust protection against automated bots while maintaining exceptional user experience.

= Features =

* **Multiple CAPTCHA Types**: Text, Math, Logic, and Image CAPTCHAs
* **Advanced Bot Detection**: Behavioral analysis, device fingerprinting, and ML-based detection
* **Easy Integration**: Works with popular form plugins out of the box
* **WooCommerce Support**: Protect checkout and login forms
* **Customizable**: Multiple themes and difficulty levels
* **GDPR Compliant**: No personal data stored

= Supported Forms =

* WordPress Login Form
* WordPress Registration Form
* WordPress Comments
* Password Reset Form
* WooCommerce Checkout
* WooCommerce Login
* Contact Form 7
* WPForms
* Gravity Forms
* Ninja Forms

= Shortcode =

Use `[secure_captcha]` to add CAPTCHA to any page or post.

= Widget =

Add the "Secure CAPTCHA" widget to any widget area.

== Installation ==

1. Upload the plugin files to `/wp-content/plugins/secure-captcha/`
2. Activate the plugin through the 'Plugins' menu in WordPress
3. Go to Settings > Secure CAPTCHA to configure
4. Enter your API URL (default: http://localhost:3000/api/v1/captcha)

== Frequently Asked Questions ==

= Do I need a separate API server? =

Yes, this plugin requires the Secure CAPTCHA API server to be running. You can deploy it using Docker or Kubernetes.

= Which CAPTCHA types are supported? =

Text, Math, Logic, and Image CAPTCHAs are supported.

= Is it GDPR compliant? =

Yes, the plugin does not store any personal data.

== Changelog ==

= 1.0.0 =
* Initial release
* Support for Text, Math, Logic, and Image CAPTCHAs
* Integration with Contact Form 7, WPForms, Gravity Forms, Ninja Forms
* WooCommerce support
* Login, Registration, and Comments protection
* Shortcode and Widget support