import unittest

from scripts.generate_practical_examples import choose_example


class ExampleGenerationTests(unittest.TestCase):
    def test_specific_problem_words_use_natural_collocations(self):
        examples = {
            "indemnify": "The insurance policy may indemnify you for the loss.",
            "proscribe": "The school rules proscribe smoking on campus.",
            "fend": "A warm coat can help fend off the cold wind.",
        }
        meanings = {
            "indemnify": "vt. 赔偿, 补偿, 保护, 保障",
            "proscribe": "vt. 剥夺...的公民权, 使失去法律保护, 排斥, 禁止",
            "fend": "vt. 击退, 保护, 供养",
        }
        for word, expected in examples.items():
            example, _, source = choose_example({"word": word, "meaning": meanings[word]})
            self.assertEqual(source, "special")
            self.assertEqual(example, expected)

    def test_fallback_examples_are_deterministic_and_not_the_old_single_template(self):
        item = {"word": "xenial", "meaning": "a. 友好的, 好客的"}
        first = choose_example(item)
        second = choose_example(item)
        self.assertEqual(first, second)
        self.assertEqual(first[2], "fallback")
        self.assertNotIn("came up in a simple conversation today", first[0])
        self.assertNotIn("I practiced how to", first[0])


if __name__ == "__main__":
    unittest.main()
