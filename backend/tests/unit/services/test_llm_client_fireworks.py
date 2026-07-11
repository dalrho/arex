import pytest
from unittest.mock import MagicMock, patch
from pydantic import BaseModel
from app.ai.llm_client import LLMClient

class MockResponseModel(BaseModel):
    status: str
    explanation: str

@patch("app.ai.llm_client.settings")
def test_llm_client_fireworks_online_completion(mock_settings):
    # Setup mock settings
    mock_settings.AI_MODE = "hackathon"
    mock_settings.is_online_mode = True
    mock_settings.FIREWORKS_API_KEY = "test-fireworks-api-key"
    mock_settings.FIREWORKS_MODEL = "accounts/fireworks/models/qwen3-32b"
    mock_settings.fireworks_model_formatted = "Qwen3-32B"

    # Instantiate LLMClient
    client = LLMClient()

    # Verify offline mode check returns False
    assert client.is_offline_mode() is False

    # Mock the Fireworks client and response
    mock_choice = MagicMock()
    mock_choice.message.content = '{"status": "success", "explanation": "all tests passed"}'
    
    mock_usage = MagicMock()
    mock_usage.prompt_tokens = 10
    mock_usage.completion_tokens = 20
    mock_usage.total_tokens = 30

    mock_completion_response = MagicMock()
    mock_completion_response.choices = [mock_choice]
    mock_completion_response.usage = mock_usage

    with patch("fireworks.Fireworks") as mock_fireworks_cls:
        mock_instance = MagicMock()
        mock_instance.chat.completions.create.return_value = mock_completion_response
        mock_fireworks_cls.return_value = mock_instance

        # Trigger structured completion
        result = client.get_completion(
            messages=[{"role": "user", "content": "hello"}],
            response_model=MockResponseModel,
            temperature=0.0
        )

        # Assert correct instantiation of Fireworks client
        mock_fireworks_cls.assert_called_once_with(api_key="test-fireworks-api-key")
        
        # Assert client.chat.completions.create called with correct parameters
        mock_instance.chat.completions.create.assert_called_once()
        call_kwargs = mock_instance.chat.completions.create.call_args[1]
        assert call_kwargs["model"] == "accounts/fireworks/models/qwen3-32b"
        assert call_kwargs["temperature"] == 0.0
        assert call_kwargs["response_format"] == {"type": "json_object"}

        # Assert correct validated return type and values
        assert isinstance(result, MockResponseModel)
        assert result.status == "success"
        assert result.explanation == "all tests passed"

@patch("app.ai.llm_client.settings")
def test_llm_client_fireworks_unstructured_completion(mock_settings):
    # Setup mock settings
    mock_settings.AI_MODE = "hackathon"
    mock_settings.is_online_mode = True
    mock_settings.FIREWORKS_API_KEY = "test-fireworks-api-key"
    mock_settings.FIREWORKS_MODEL = "accounts/fireworks/models/qwen3-32b"
    mock_settings.fireworks_model_formatted = "Qwen3-32B"

    client = LLMClient()

    mock_choice = MagicMock()
    mock_choice.message.content = "This is a plain text response"
    
    mock_completion_response = MagicMock()
    mock_completion_response.choices = [mock_choice]
    mock_completion_response.usage = None

    with patch("fireworks.Fireworks") as mock_fireworks_cls:
        mock_instance = MagicMock()
        mock_instance.chat.completions.create.return_value = mock_completion_response
        mock_fireworks_cls.return_value = mock_instance

        result = client.get_completion(
            messages=[{"role": "user", "content": "tell me a story"}],
            temperature=0.7
        )

        assert result == "This is a plain text response"
        mock_instance.chat.completions.create.assert_called_once()
        call_kwargs = mock_instance.chat.completions.create.call_args[1]
        assert call_kwargs["model"] == "accounts/fireworks/models/qwen3-32b"
        assert call_kwargs["temperature"] == 0.7
        assert "response_format" not in call_kwargs

@patch("app.ai.llm_client.settings")
def test_llm_client_gemini_online_completion(mock_settings):
    # Setup mock settings
    mock_settings.AI_MODE = "developer"
    mock_settings.is_online_mode = True
    mock_settings.effective_gemini_key = "test-gemini-api-key"
    mock_settings.GEMINI_MODEL = "gemini-2.5-flash"

    client = LLMClient()

    # Verify offline mode check returns False
    assert client.is_offline_mode() is False

    # Mock the Gemini client and response
    mock_response = MagicMock()
    mock_response.text = '{"status": "success", "explanation": "gemini tests passed"}'
    mock_response.usage_metadata = MagicMock(
        prompt_token_count=15,
        candidates_token_count=25,
        total_token_count=40
    )

    with patch("google.genai.Client") as mock_genai_cls:
        mock_instance = MagicMock()
        mock_instance.models.generate_content.return_value = mock_response
        mock_genai_cls.return_value = mock_instance

        # Trigger structured completion
        result = client.get_completion(
            messages=[{"role": "user", "content": "hello"}],
            response_model=MockResponseModel,
            temperature=0.0
        )

        mock_genai_cls.assert_called_once_with(api_key="test-gemini-api-key")
        mock_instance.models.generate_content.assert_called_once()
        call_kwargs = mock_instance.models.generate_content.call_args[1]
        assert call_kwargs["model"] == "gemini-2.5-flash"
        assert call_kwargs["config"].temperature == 0.0

        assert isinstance(result, MockResponseModel)
        assert result.status == "success"
        assert result.explanation == "gemini tests passed"

@patch("app.ai.llm_client.settings")
def test_llm_client_gemini_unstructured_completion(mock_settings):
    # Setup mock settings
    mock_settings.AI_MODE = "developer"
    mock_settings.is_online_mode = True
    mock_settings.effective_gemini_key = "test-gemini-api-key"
    mock_settings.GEMINI_MODEL = "gemini-2.5-flash"

    client = LLMClient()

    mock_response = MagicMock()
    mock_response.text = "This is a plain text Gemini response"
    mock_response.usage_metadata = None

    with patch("google.genai.Client") as mock_genai_cls:
        mock_instance = MagicMock()
        mock_instance.models.generate_content.return_value = mock_response
        mock_genai_cls.return_value = mock_instance

        result = client.get_completion(
            messages=[{"role": "user", "content": "tell me a story"}],
            temperature=0.7
        )

        assert result == "This is a plain text Gemini response"
        mock_instance.models.generate_content.assert_called_once()
        call_kwargs = mock_instance.models.generate_content.call_args[1]
        assert call_kwargs["model"] == "gemini-2.5-flash"
        assert call_kwargs["config"].temperature == 0.7

@patch("app.ai.llm_client.settings")
def test_llm_client_offline_completion(mock_settings):
    # Setup mock settings
    mock_settings.AI_MODE = "offline"
    mock_settings.is_online_mode = False

    from app.api.v1.schemas.regulation import RegulatoryIntelligenceOutput

    client = LLMClient()

    # Verify offline mode check returns True
    assert client.is_offline_mode() is True

    result = client.get_completion(
        messages=[{"role": "user", "content": "hello"}],
        response_model=RegulatoryIntelligenceOutput,
        temperature=0.0
    )

    # In offline mode we should get mock response
    assert isinstance(result, RegulatoryIntelligenceOutput)
    assert result.relevant is not None
    assert result.rationale is not None
