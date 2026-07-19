import unittest


class PublicSiteTests(unittest.TestCase):
    def test_public_site_pages_are_valid(self):
        from scripts.validate_public_site import validate_public_site

        self.assertEqual(validate_public_site(), [])


if __name__ == "__main__":
    unittest.main()
