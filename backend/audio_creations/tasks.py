import azure.cognitiveservices.speech as speechsdk
from django.conf import settings
from django.db import transaction
from django.core.files.base import ContentFile
import logging

from .models import AudioCreation

logger = logging.getLogger(__name__)

def generate_audio_from_text_sync(creation_id: str):
    """
    Synchronous version of audio generation.
    For async processing, use Celery task generate_audio_from_text.delay()
    """
    creation = None
    try:
        creation = AudioCreation.objects.get(id=creation_id)
        if creation.status != AudioCreation.Status.PENDING:
            logger.warning(f"Skipping audio generation for {creation_id} as its status is already '{creation.status}'.")
            return f"Task for {creation_id} already processed."
        
        creation.status = AudioCreation.Status.PROCESSING
        creation.save(update_fields=['status'])
    except AudioCreation.DoesNotExist:
        logger.error(f"AudioCreation with id {creation_id} not found.")
        return f"AudioCreation with id {creation_id} not found."

    try:
        # Check if Azure Speech credentials are configured
        if not hasattr(settings, 'AZURE_SPEECH_KEY') or not hasattr(settings, 'AZURE_SPEECH_ENDPOINT'):
            raise Exception("Azure Speech credentials not configured. Please set AZURE_SPEECH_KEY and AZURE_SPEECH_ENDPOINT in settings.")
        
        speech_config = speechsdk.SpeechConfig(
            subscription=settings.AZURE_SPEECH_KEY, 
            endpoint=settings.AZURE_SPEECH_ENDPOINT
        )
        speech_config.speech_synthesis_voice_name = creation.voice
        
        output_format_map = {
            'mp3': speechsdk.SpeechSynthesisOutputFormat.Audio24Khz160KBitRateMonoMp3,
            'opus': speechsdk.SpeechSynthesisOutputFormat.Ogg24Khz16BitMonoOpus,
            'aac': speechsdk.SpeechSynthesisOutputFormat.Audio24Khz96KBitRateMonoMp3,
            'wav': speechsdk.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm,
        }
        
        output_format = output_format_map.get(creation.response_format)
        
        if not output_format:
            raise ValueError(f"Unsupported audio format requested: '{creation.response_format}'. Please choose from mp3, opus, aac, or wav.")

        speech_config.set_speech_synthesis_output_format(output_format)

        synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config, audio_config=None)

        rate_percentage = f"{((creation.speed - 1.0) * 100):+.2f}%"
        ssml_string = f"""
        <speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>
            <voice name='{creation.voice}'>
                <prosody rate='{rate_percentage}'>
                    {creation.text_input}
                </prosody>
            </voice>
        </speak>
        """
        
        result = synthesizer.speak_ssml_async(ssml_string).get()

        if result.reason == speechsdk.ResultReason.Canceled:
            cancellation_details = result.cancellation_details
            error_details = cancellation_details.error_details if cancellation_details.error_details else "No details provided."
            if "authentication" in error_details.lower():
                raise Exception("Authentication failed. Please check your Azure Speech API key and endpoint.")
            raise Exception(f"Speech synthesis canceled: {cancellation_details.reason}. Details: {error_details}")
        
        if not result.audio_data:
            raise Exception("Synthesis completed but no audio data was returned from the service.")

        audio_data = result.audio_data
        file_extension = 'mp3' if creation.response_format == 'aac' else creation.response_format
        file_name = f'{creation.id}.{file_extension}'
        file_content = ContentFile(audio_data)
        
        with transaction.atomic():
            creation.result_file.save(file_name, file_content, save=False)
            creation.status = AudioCreation.Status.COMPLETED
            creation.error_message = None
            creation.save(update_fields=['result_file', 'status', 'error_message'])
            
        return f"Successfully processed audio creation {creation.id}."

    except Exception as e:
        error_message = str(e)
        logger.error(f"ERROR during audio generation for {creation_id}: {error_message}")
        if creation:
            with transaction.atomic():
                creation.error_message = error_message
                creation.status = AudioCreation.Status.FAILED
                creation.save(update_fields=['error_message', 'status'])
        return f"Failed audio creation {creation_id}."

# Celery task version (uncomment if you have Celery configured)
# from celery import shared_task
# 
# @shared_task(bind=True)
# def generate_audio_from_text(self, creation_id: str):
#     return generate_audio_from_text_sync(creation_id)
